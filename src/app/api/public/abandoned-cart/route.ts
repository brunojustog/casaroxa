/**
 * POST /api/public/abandoned-cart
 *
 * Capturado no CheckoutClient com debounce — body inclui phone + items
 * do cart. Faz upsert (idempotente por phone).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertAbandonedCart } from "@/server/services/abandoned-cart.service";
import { BusinessError } from "@/server/auth-helpers";

const itemSchema = z.object({
  kind: z.enum(["PRODUTO", "COMBO"]),
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  price: z.number().nonnegative(),
  quantity: z.number().int().min(1).max(100),
});

const schema = z.object({
  customerPhone: z.string().trim().min(10).max(40),
  customerName: z.string().trim().max(120).optional().nullable(),
  items: z.array(itemSchema).min(1).max(50),
});

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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      },
      { status: 400 },
    );
  }
  try {
    const cart = await upsertAbandonedCart({
      customerPhone: parsed.data.customerPhone,
      customerName: parsed.data.customerName,
      items: parsed.data.items,
    });
    return NextResponse.json({ ok: true, id: cart.id });
  } catch (e) {
    if (e instanceof BusinessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("[api/public/abandoned-cart]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado." },
      { status: 500 },
    );
  }
}
