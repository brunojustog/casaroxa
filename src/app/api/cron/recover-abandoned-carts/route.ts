/**
 * Cron pra enviar WhatsApp de recuperação de carrinho abandonado.
 *
 * Configurar no crontab do manager (ex: a cada 15 min):
 *   "*\/15 * * * *" + curl -H "x-cron-token: $TOKEN" \
 *     https://gestao.casaroxa.com.br/api/cron/recover-abandoned-carts
 */
import { NextResponse } from "next/server";
import { notifyAbandonedCarts } from "@/server/services/abandoned-cart.service";

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
    const result = await notifyAbandonedCarts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/recover-abandoned-carts]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado." },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
