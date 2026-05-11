import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  setSessionCookie,
} from "@/server/services/customer-session.service";

const PENDING_PHONE_COOKIE = "casaroxa_pending_phone";

/**
 * Finaliza o cadastro de um cliente que verificou o telefone via OTP
 * mas ainda não tinha Customer (caso típico: cliente novo entrando em
 * sorteio sem ter feito pedido antes).
 *
 * Lê o phone do cookie `casaroxa_pending_phone` (setado pelo /verify
 * quando authenticated=false), recebe o nome no body, cria o Customer
 * e a sessão.
 */
export async function POST(req: Request) {
  const store = await cookies();
  const pendingPhone = store.get(PENDING_PHONE_COOKIE)?.value;

  if (!pendingPhone) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sessão de cadastro expirou. Comece de novo pedindo o código no WhatsApp.",
      },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name || name.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Digite seu nome (pelo menos 2 letras)." },
      { status: 400 },
    );
  }
  if (name.length > 120) {
    return NextResponse.json(
      { ok: false, error: "Nome longo demais." },
      { status: 400 },
    );
  }

  // Race-safe: se outro cliente já criou Customer com esse phone enquanto
  // o cookie estava ativo, usa o existente em vez de quebrar com unique.
  let customer = await prisma.customer.findUnique({
    where: { phone: pendingPhone },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { name, phone: pendingPhone },
    });
  }

  const ua = req.headers.get("user-agent") ?? null;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const session = await createSession(customer.id, { userAgent: ua, ip });
  await setSessionCookie(session.token, session.expiresAt);

  // Limpa cookie pending — já cumpriu sua função.
  store.delete(PENDING_PHONE_COOKIE);

  return NextResponse.json({
    ok: true,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    },
  });
}
