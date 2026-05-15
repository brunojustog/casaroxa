/**
 * Cron pra marcar AiActionApproval PENDING > 24h como EXPIRED.
 * Configurar a cada hora no crontab.
 */
import { NextResponse } from "next/server";
import { expirePendingActions } from "@/server/services/ai-action.service";

export async function POST(req: Request) {
  const expected = process.env.CRON_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_TOKEN não configurado." },
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
    const result = await expirePendingActions();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/expire-ai-actions]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado." },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
