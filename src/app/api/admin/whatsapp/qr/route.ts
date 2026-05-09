import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getQRCode } from "@/server/services/whatsapp.service";

/** Pega QR code atual (sessão precisa ter sido iniciada via /connect antes). */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }
  const r = await getQRCode();
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error ?? "Falha ao consultar QR." },
      { status: 200 },
    );
  }
  return NextResponse.json({ ok: true, qrcode: r.qrcode, data: r.data });
}
