/**
 * POST /api/public/order
 *
 * Endpoint público (sem auth) que recebe pedidos do checkout do cardápio
 * online e cria uma Sale ABERTA com source SITE no sistema interno.
 * Retorna o ID, número da venda e link WhatsApp pré-montado.
 */
import { NextResponse } from "next/server";
import { publicOrderSchema } from "@/schemas/public-order.schema";
import {
  createPublicOrder,
  PublicOrderError,
} from "@/server/services/public-order.service";

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

  const parsed = publicOrderSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json(
      { ok: false, error: first?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  try {
    const result = await createPublicOrder(parsed.data);
    return NextResponse.json({
      ok: true,
      saleId: result.saleId,
      saleNumber: result.saleNumber,
      subtotal: result.subtotal,
      couponCode: result.couponCode,
      couponDiscount: result.couponDiscount,
      total: result.total,
      whatsappLink: result.whatsappLink,
      trackingUrl: result.trackingUrl,
    });
  } catch (e) {
    if (e instanceof PublicOrderError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("[api/public/order]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
