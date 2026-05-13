import { NextResponse } from "next/server";
import { cleanupExpiredReservations } from "@/server/services/sales-event.service";

/**
 * Endpoint pra cron limpar reservas de pré-venda expiradas. Protegido por
 * shared secret no header `x-cron-token` ou query `?token=`.
 *
 * Configurar `CRON_TOKEN` no env. Adicionar no crontab do manager:
 *   "*\/5 * * * *" + curl -s -H "x-cron-token: $TOKEN" https://gestao.casaroxa.com.br/api/cron/cleanup-reservations
 *
 * Roda a cada 5min é suficiente — timeout de reserva padrão é 120min.
 */
export async function POST(req: Request) {
  const expected = process.env.CRON_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_TOKEN não configurado no servidor." },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  const received =
    req.headers.get("x-cron-token") ?? url.searchParams.get("token");
  if (received !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }
  try {
    const released = await cleanupExpiredReservations();
    return NextResponse.json({ ok: true, released });
  } catch (e) {
    console.error("[cron/cleanup-reservations]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado." },
      { status: 500 },
    );
  }
}

// Aceita também GET pra facilitar configuração de cron via curl simples
export async function GET(req: Request) {
  return POST(req);
}
