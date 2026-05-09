/**
 * GET /api/public/sale/[id]
 *
 * Endpoint público (sem auth) usado pela página /pedido/[id] de tracking.
 * Retorna apenas dados seguros: progresso, items, total — sem custo, telefone
 * ou endereço (que ficam só nas notes internas da Sale).
 */
import { NextResponse } from "next/server";
import { getPublicSaleTracking } from "@/server/services/sales.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sale = await getPublicSaleTracking(id);
  if (!sale) {
    return NextResponse.json(
      { ok: false, error: "Pedido não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    sale: {
      id: sale.id,
      number: sale.number,
      occurredAt: sale.occurredAt.toISOString(),
      customerName: sale.customerName,
      status: sale.status,
      progress: sale.progress,
      progressUpdatedAt: sale.progressUpdatedAt?.toISOString() ?? null,
      progressEstimateMinutes: sale.progressEstimateMinutes,
      total: Number(sale.totalRevenue),
      cancelledAt: sale.cancelledAt?.toISOString() ?? null,
      cancelReason: sale.cancelReason,
      items: sale.items.map((it) => ({
        id: it.id,
        name: it.product?.name ?? it.combo?.name ?? "—",
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        totalPrice: Number(it.totalPrice),
      })),
    },
  });
}
