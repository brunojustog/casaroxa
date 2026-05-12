import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedCustomer } from "@/server/services/customer-session.service";
import { enterRaffleFree } from "@/server/services/raffle.service";
import { BusinessError } from "@/server/auth-helpers";

/**
 * Inscrição GRATUITA em rifa (ticketPriceCents=0). Cliente envia os
 * números escolhidos da grade; entries são criadas com confirmed=true direto.
 */
const bodySchema = z.object({
  numbers: z.array(z.number().int().min(1)).min(1).max(500),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const customer = await getAuthedCustomer();
  if (!customer) {
    return NextResponse.json(
      {
        ok: false,
        error: "Identifique-se pelo WhatsApp pra participar do sorteio.",
        needsAuth: true,
      },
      { status: 401 },
    );
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  try {
    const result = await enterRaffleFree(id, customer.id, parsed.data.numbers);
    return NextResponse.json({
      ok: true,
      numbers: result.entries.map((e) => e.number),
    });
  } catch (e) {
    if (e instanceof BusinessError) {
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: 400 },
      );
    }
    console.error("[raffles/enter]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado. Tente de novo." },
      { status: 500 },
    );
  }
}
