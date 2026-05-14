/**
 * POST /api/public/upsells
 *
 * Recebe os items do cart atual, retorna sugestões de upsell baseado em
 * categoria complementar. Sem auth — só usa metadata do cardápio público.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUpsellsForCart } from "@/server/services/upsell.service";

const schema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["PRODUTO", "COMBO"]),
      }),
    )
    .max(50),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  try {
    const suggestions = await getUpsellsForCart({ items: parsed.data.items });
    return NextResponse.json({ ok: true, suggestions });
  } catch (e) {
    console.error("[api/public/upsells]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado." },
      { status: 500 },
    );
  }
}
