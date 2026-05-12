import { NextResponse } from "next/server";
import { getAuthedCustomer } from "@/server/services/customer-session.service";
import { getRaffleNumbersState } from "@/server/services/raffle.service";
import { BusinessError } from "@/server/auth-helpers";

/**
 * Estado da grade de números pra UI desenhar:
 *   - totalNumbers
 *   - taken: array de números vendidos/reservados
 *   - mine / minePending: números do cliente (se logado)
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const customer = await getAuthedCustomer();
  try {
    const state = await getRaffleNumbersState(id, customer?.id ?? null);
    return NextResponse.json({ ok: true, ...state });
  } catch (e) {
    if (e instanceof BusinessError) {
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: 400 },
      );
    }
    console.error("[raffles/numbers]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado." },
      { status: 500 },
    );
  }
}
