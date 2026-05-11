import { NextResponse } from "next/server";
import { getAuthedCustomer } from "@/server/services/customer-session.service";
import { enterRaffle } from "@/server/services/raffle.service";

/**
 * Cliente identificado (cookie de sessão pós-OTP) entra num sorteio aberto.
 * Idempotente: chamar de novo retorna o mesmo número da entrada.
 */
export async function POST(
  _req: Request,
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
  const result = await enterRaffle(id, customer.id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    number: result.number,
    alreadyEntered: result.alreadyEntered,
  });
}
