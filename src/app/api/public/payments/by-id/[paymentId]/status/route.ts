import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Polling de status — versão polimórfica (paymentId direto). Aceita payment
 * de Sale ou de RaffleEntry e retorna o que a UI precisa pra parar polling:
 *   - status do OnlinePayment normalizado
 *   - se Sale: status da Sale (CONCLUIDA = pago)
 *   - se RaffleEntry: confirmed + número (entry virou número da sorte)
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await ctx.params;
  const payment = await prisma.onlinePayment.findUnique({
    where: { id: paymentId },
    include: {
      sale: { select: { status: true, number: true } },
      raffleEntry: { select: { confirmed: true, number: true } },
    },
  });
  if (!payment) {
    return NextResponse.json(
      { ok: false, error: "Pagamento não encontrado." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    ok: true,
    status: payment.status,
    saleStatus: payment.sale?.status ?? null,
    saleNumber: payment.sale?.number ?? null,
    raffleConfirmed: payment.raffleEntry?.confirmed ?? null,
    raffleNumber: payment.raffleEntry?.number ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
  });
}
