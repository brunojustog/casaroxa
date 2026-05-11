/**
 * Sessão de cliente público (sem auth/sem senha) — emitida após verificar
 * OTP no WhatsApp. Token opaco aleatório guardado em cookie httpOnly.
 *
 * Convenções:
 *   - Cookie: "casaroxa_customer", httpOnly, secure (prod), sameSite=lax
 *   - Token: 32 bytes hex (64 chars) — gerado com crypto.randomBytes
 *   - Vida útil: 30 dias (config DAYS_VALID)
 *   - Cada acesso atualiza lastSeenAt (analytics + futura detecção de
 *     sessões abandonadas)
 */
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "casaroxa_customer";
const DAYS_VALID = 30;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(
  customerId: string,
  meta?: { userAgent?: string | null; ip?: string | null },
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + DAYS_VALID * 24 * 60 * 60 * 1000);
  await prisma.customerSession.create({
    data: {
      token,
      customerId,
      expiresAt,
      userAgent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
    },
  });
  return { token, expiresAt };
}

/**
 * Lê o cookie da request atual e retorna o Customer correspondente
 * (ou null se cookie ausente/inválido/expirado).
 *
 * Atualiza lastSeenAt assincronamente — não bloqueia a resposta.
 */
export async function getAuthedCustomer() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.customerSession.findUnique({
    where: { token },
    include: { customer: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.customer.active) return null;

  // Touch lastSeenAt sem await — best-effort
  prisma.customerSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  return session.customer;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.customerSession
      .deleteMany({ where: { token } })
      .catch(() => undefined);
  }
  store.delete(COOKIE_NAME);
}

/** Limpa sessões expiradas — pode ser chamada por cron eventualmente. */
export async function purgeExpiredSessions() {
  return prisma.customerSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
