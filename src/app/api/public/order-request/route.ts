/**
 * POST /api/public/order-request
 *
 * Endpoint público (sem auth) que recebe encomendas pelo site.
 * Diferente do /api/public/order, esse fluxo:
 *   - aceita data/hora futura desejada (requestedFor)
 *   - valida antecedência mínima (Settings.orderLeadTimeHours, default 48h)
 *   - cria OrderRequest com status PENDENTE
 *   - admin aprova/recusa manualmente no painel
 *   - quando aprovada, gera Sale automaticamente
 */
import { NextResponse } from "next/server";
import {
  capiContextFromRequest,
  sendMetaEvent,
} from "@/server/services/meta-capi.service";
import { publicOrderRequestSchema } from "@/schemas/order-request.schema";
import { createPublicOrderRequest } from "@/server/services/order-request.service";
import { BusinessError } from "@/server/auth-helpers";
import { sendPushToAllUsers } from "@/server/services/push.service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 },
    );
  }

  const parsed = publicOrderRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const path = first?.path.join(".");
    return NextResponse.json(
      {
        ok: false,
        error: path ? `${path}: ${first.message}` : first?.message ?? "Dados inválidos.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await createPublicOrderRequest(parsed.data);

    // CAPI: Lead servidor→Meta, deduplicado com o Pixel (lead-<id>).
    sendMetaEvent({
      eventName: "Lead",
      eventId: `lead-${result.id}`,
      value: result.totalCents / 100,
      context: capiContextFromRequest(request),
    });

    // Notifica admins (fire and forget)
    sendPushToAllUsers({
      title: `Nova encomenda ER-${result.number}`,
      body: `${parsed.data.customerName} · ${new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(parsed.data.requestedFor)}`,
      url: `/encomendas/${result.id}`,
      tag: `order-request-${result.id}`,
    }).catch((e) => console.error("[order-request] push falhou:", e));

    return NextResponse.json({
      ok: true,
      id: result.id,
      number: result.number,
    });
  } catch (e) {
    if (e instanceof BusinessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("[api/public/order-request]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
