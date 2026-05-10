import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import {
  connectSession,
  extractQRStringFromPayload,
  getQRCode,
} from "@/server/services/whatsapp.service";

/**
 * Inicia a sessão na wuzapi e retorna o QR code (se já vier no connect)
 * ou tenta puxar via /session/qr na sequência. Idempotente — chamar
 * de novo regenera o QR.
 *
 * Sempre retorna `raw` (payload completo) pra ajudar a debugar se a UI
 * não conseguir extrair o QR.
 */
export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const connect = await connectSession();
  if (!connect.ok) {
    return NextResponse.json(
      { ok: false, error: connect.error ?? "Falha ao iniciar sessão." },
      { status: 200 },
    );
  }

  const fromConnect = extractQRStringFromPayload(connect.data);
  if (fromConnect) {
    return NextResponse.json({
      ok: true,
      qrcode: fromConnect,
      raw: connect.data,
    });
  }

  // Fallback: chama /session/qr separado.
  const qr = await getQRCode();
  if (!qr.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: qr.error ?? "Sessão iniciada, mas falha ao pegar QR.",
        raw: connect.data,
      },
      { status: 200 },
    );
  }
  return NextResponse.json({
    ok: true,
    qrcode: qr.qrcode,
    raw: qr.data,
    connectRaw: connect.data,
  });
}
