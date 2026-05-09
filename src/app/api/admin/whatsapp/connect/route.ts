import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import {
  connectSession,
  getQRCode,
} from "@/server/services/whatsapp.service";

/**
 * Inicia a sessão na wuzapi e retorna o QR code (se já vier no connect)
 * ou tenta puxar via /session/qr na sequência. Idempotente — chamar
 * de novo regenera o QR.
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

  // Algumas versões já trazem o QR no /connect, outras não — tenta extrair.
  const fromConnect =
    (connect.data?.code as string | undefined) ??
    (connect.data?.qrcode as string | undefined) ??
    ((connect.data?.data as { qrcode?: string; code?: string } | undefined)
      ?.qrcode ??
      (connect.data?.data as { qrcode?: string; code?: string } | undefined)
        ?.code);

  if (fromConnect) {
    return NextResponse.json({ ok: true, qrcode: fromConnect });
  }

  // Fallback: chama /session/qr separado.
  const qr = await getQRCode();
  if (!qr.ok) {
    return NextResponse.json(
      { ok: false, error: qr.error ?? "Sessão iniciada, mas falha ao pegar QR." },
      { status: 200 },
    );
  }
  return NextResponse.json({ ok: true, qrcode: qr.qrcode, data: qr.data });
}
