import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/server/services/payment.service";

/**
 * Webhook do Asaas — chamado quando status de uma cobrança muda.
 *
 * Validação: o Asaas envia o header `asaas-access-token` com um token
 * configurado no painel deles. Comparamos com env ASAAS_WEBHOOK_TOKEN.
 * Sem token configurado, aceitamos qualquer chamada (modo dev).
 *
 * Sempre retorna 200 OK quando processou (mesmo que tenha ignorado),
 * pra evitar que Asaas fique re-tentando. 400/401 só pra erro real.
 */
export async function POST(req: Request) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (expectedToken) {
    const received = req.headers.get("asaas-access-token")?.trim();
    if (received !== expectedToken) {
      return NextResponse.json(
        { ok: false, error: "Token de webhook inválido." },
        { status: 401 },
      );
    }
  }

  const body = (await req.json().catch(() => null)) as {
    event?: string;
    payment?: { id: string; status: string; value?: number };
  } | null;

  if (!body?.event) {
    return NextResponse.json(
      { ok: false, error: "Payload sem event." },
      { status: 400 },
    );
  }

  try {
    const result = await handlePaymentWebhook({
      event: body.event,
      payment: body.payment,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[webhook/asaas]", e);
    // Retorna 200 mesmo em erro pra evitar retry infinito.
    return NextResponse.json({ ok: false, error: "Erro interno." });
  }
}
