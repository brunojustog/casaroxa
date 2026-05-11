import { NextResponse } from "next/server";
import { getOnlinePaymentBySaleId } from "@/server/services/payment.service";
import { prisma } from "@/lib/prisma";

/**
 * Polling pra UI saber se pagamento foi confirmado.
 * Retorna status normalizado + status da Sale (CONCLUIDA = pode parar polling).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ saleId: string }> },
) {
  const { saleId } = await ctx.params;
  const payment = await getOnlinePaymentBySaleId(saleId);
  if (!payment) {
    return NextResponse.json(
      { ok: false, error: "Pagamento não encontrado." },
      { status: 404 },
    );
  }
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: { status: true, number: true },
  });
  return NextResponse.json({
    ok: true,
    status: payment.status,
    saleStatus: sale?.status ?? null,
    saleNumber: sale?.number ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
  });
}
