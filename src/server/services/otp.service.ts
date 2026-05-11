/**
 * Autenticação leve de cliente via OTP no WhatsApp.
 *
 * Fluxo:
 *   1. Cliente digita o telefone → requestOtp() gera 6 dígitos,
 *      salva hash (bcrypt) com expiração de 10min e dispara mensagem
 *      via wuzapi (event=OTP).
 *   2. Cliente cola o código → verifyOtp() compara hash, marca como
 *      consumido, e retorna o Customer (ou null se telefone não tem cadastro).
 *
 * Rate limits (defensivos contra spam/abuse):
 *   - Máx 3 OTPs ativos por telefone a cada 60min
 *   - 1 envio a cada 60s por telefone
 *   - 5 tentativas de verificação por OTP (depois disso, expira)
 *
 * Telefones SEM cadastro de Customer ainda podem receber OTP —
 * o verify só não devolve sessão (sem nada pra autenticar). Útil
 * pra evitar revelar "esse telefone tá cadastrado?".
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { sendText } from "./whatsapp.service";

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_ACTIVE_PER_HOUR = 3;
const COOLDOWN_SECONDS = 60;

function generateCode(): string {
  let s = "";
  for (let i = 0; i < OTP_LENGTH; i++) {
    s += Math.floor(Math.random() * 10);
  }
  return s;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  if (digits.length >= 12 && digits.length <= 13 && digits.startsWith("55")) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return "55" + digits;
  }
  return digits;
}

export type RequestOtpResult = {
  ok: true;
  challengeId: string;
  expiresAt: Date;
};

/**
 * Gera + envia um novo OTP. Throws BusinessError se rate limit estourar
 * ou se WhatsApp falhar em enviar (cliente nunca recebe → não adianta verify).
 */
export async function requestOtp(
  rawPhone: string,
  ip?: string,
): Promise<RequestOtpResult> {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 12) {
    throw new BusinessError("Telefone inválido. Use DDD + número, ex: (14) 99999-1234.");
  }

  // Cooldown: último envio há menos de 60s
  const since = new Date(Date.now() - COOLDOWN_SECONDS * 1000);
  const recent = await prisma.otpChallenge.findFirst({
    where: { phone, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const elapsed = Math.floor((Date.now() - recent.createdAt.getTime()) / 1000);
    const waitSeconds = COOLDOWN_SECONDS - elapsed;
    throw new BusinessError(
      `Aguarde ${waitSeconds}s antes de pedir outro código.`,
    );
  }

  // Limite de 3 ativos por hora
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const activeCount = await prisma.otpChallenge.count({
    where: {
      phone,
      createdAt: { gte: oneHourAgo },
      consumedAt: null,
      expiresAt: { gte: new Date() },
    },
  });
  if (activeCount >= MAX_ACTIVE_PER_HOUR) {
    throw new BusinessError(
      "Muitos códigos pedidos. Tente de novo em 1 hora.",
    );
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 6);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  const challenge = await prisma.otpChallenge.create({
    data: { phone, codeHash, expiresAt, ip: ip ?? null },
  });

  // Tenta enviar via wuzapi. Bypassa toggles porque é segurança, não opcional.
  const message = `Casa Roxa: seu código é *${code}* — expira em ${OTP_TTL_MINUTES} minutos. Se não foi você, ignore.`;
  const sendResult = await sendText({
    phone,
    message,
    event: "OTP",
    bypassToggles: true,
    typingDelayMs: 500,
  });

  if (sendResult.status === "FAILED") {
    // Apaga o challenge — não tem como o cliente verificar.
    await prisma.otpChallenge
      .delete({ where: { id: challenge.id } })
      .catch(() => undefined);
    throw new BusinessError(
      "Não consegui enviar o código por WhatsApp. Tente de novo em alguns segundos.",
    );
  }

  return { ok: true, challengeId: challenge.id, expiresAt };
}

export type VerifyOtpResult =
  | { ok: true; customerId: string | null; phone: string }
  | { ok: false; error: string };

/**
 * Verifica código de OTP. Retorna customerId se existe Customer com aquele
 * telefone (pra criar sessão); null se não — mas verify passa mesmo assim,
 * pra UI poder dizer "código ok mas você ainda não tem cadastro, faça
 * seu primeiro pedido normalmente".
 */
export async function verifyOtp(
  challengeId: string,
  code: string,
): Promise<VerifyOtpResult> {
  const challenge = await prisma.otpChallenge.findUnique({
    where: { id: challengeId },
  });
  if (!challenge) {
    return { ok: false, error: "Código inválido ou expirado." };
  }
  if (challenge.consumedAt) {
    return { ok: false, error: "Código já foi usado." };
  }
  if (challenge.expiresAt < new Date()) {
    return { ok: false, error: "Código expirou. Peça um novo." };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Muitas tentativas. Peça um novo código." };
  }

  // Tentativa: incrementa contador antes de comparar (sempre, mesmo se acertar).
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { attempts: { increment: 1 } },
  });

  const cleanCode = code.trim().replace(/\D+/g, "");
  const valid = await bcrypt.compare(cleanCode, challenge.codeHash);
  if (!valid) {
    const remaining = MAX_ATTEMPTS - challenge.attempts - 1;
    if (remaining <= 0) {
      return {
        ok: false,
        error: "Código incorreto. Limite de tentativas atingido — peça um novo.",
      };
    }
    return {
      ok: false,
      error: `Código incorreto. Restam ${remaining} tentativa(s).`,
    };
  }

  // Marca como consumido
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  // Busca Customer (se existir) pelo telefone
  const customer = await prisma.customer.findUnique({
    where: { phone: challenge.phone },
    select: { id: true },
  });

  return {
    ok: true,
    customerId: customer?.id ?? null,
    phone: challenge.phone,
  };
}
