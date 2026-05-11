import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyOtp } from "@/server/services/otp.service";
import {
  createSession,
  setSessionCookie,
} from "@/server/services/customer-session.service";

const PENDING_PHONE_COOKIE = "casaroxa_pending_phone";
const PENDING_PHONE_TTL_MIN = 15;

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

  // Sem Customer cadastrado: telefone está verificado mas falta nome.
  // Setta cookie temporário (15min) com o phone, frontend pede o nome
  // e chama /api/public/customer/complete-signup pra finalizar.
  if (!result.customerId) {
    const store = await cookies();
    store.set(PENDING_PHONE_COOKIE, result.phone, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PENDING_PHONE_TTL_MIN * 60,
    });
    return NextResponse.json({
      ok: true,
      authenticated: false,
      needsName: true,
      phone: result.phone,
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
