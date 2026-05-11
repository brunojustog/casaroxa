import { NextResponse } from "next/server";
import { requestOtp } from "@/server/services/otp.service";
import { BusinessError } from "@/server/auth-helpers";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { phone?: string } | null;
  if (!body?.phone) {
    return NextResponse.json(
      { ok: false, error: "Telefone é obrigatório." },
      { status: 400 },
    );
  }
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null;

  try {
    const result = await requestOtp(body.phone, ip ?? undefined);
    return NextResponse.json({
      ok: true,
      challengeId: result.challengeId,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof BusinessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("[otp/request]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado. Tente de novo." },
      { status: 500 },
    );
  }
}
