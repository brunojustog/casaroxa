import { NextResponse } from "next/server";
import { verifyOtp } from "@/server/services/otp.service";
import {
  createSession,
  setSessionCookie,
} from "@/server/services/customer-session.service";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { challengeId?: string; code?: string }
    | null;
  if (!body?.challengeId || !body.code) {
    return NextResponse.json(
      { ok: false, error: "Dados inválidos." },
      { status: 400 },
    );
  }

  const result = await verifyOtp(body.challengeId, body.code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  // Sem Customer cadastrado: código válido mas sem sessão criada.
  // Cliente segue como "convidado" — só recebe atalho de identificação
  // se já tinha feito pedido antes.
  if (!result.customerId) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      phone: result.phone,
      message:
        "Código confirmado, mas você ainda não tem cadastro. Faça seu primeiro pedido normalmente.",
    });
  }

  const ua = req.headers.get("user-agent") ?? null;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const session = await createSession(result.customerId, { userAgent: ua, ip });
  await setSessionCookie(session.token, session.expiresAt);

  return NextResponse.json({
    ok: true,
    authenticated: true,
    customerId: result.customerId,
  });
}
