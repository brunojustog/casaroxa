/** GET /api/public/push/key — chave pública VAPID pro site (sem auth). */
import { NextResponse } from "next/server";
import { getPushPublicKey } from "@/server/services/push.service";

export async function GET() {
  const key = getPushPublicKey();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Push não configurado" },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, publicKey: key });
}
