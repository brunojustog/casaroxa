import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Polling de status — versão polimórfica (paymentId direto).
 *   - Sale: status da Sale (CONCLUIDA = pago)
 *   - Rifa: ao menos uma entry confirmed = pagamento entrou
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
      raffleEntries: { select: { confirmed: true } },
    },
  });
  if (!payment) {
    return NextResponse.json(
      { ok: false, error: "Pagamento não encontrado." },
      { status: 404 },
    );
  }
  const raffleConfirmed =
    payment.raffleEntries.length > 0 &&
    payment.raffleEntries.every((e) => e.confirmed);
  return NextResponse.json({
    ok: true,
    status: payment.status,
    saleStatus: payment.sale?.status ?? null,
    saleNumber: payment.sale?.number ?? null,
    raffleConfirmed: payment.raffleEntries.length > 0 ? raffleConfirmed : null,
    paidAt: payment.paidAt?.toISOString() ?? null,
  });
}
