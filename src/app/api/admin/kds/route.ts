import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getKdsOrders } from "@/server/services/sales.service";

/**
 * Endpoint do KDS — usado pelo polling do client.
 * Retorna pedidos ativos (status != ENTREGUE) das últimas 24h.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }
  try {
    const orders = await getKdsOrders();
    return NextResponse.json({
      ok: true,
      now: new Date().toISOString(),
      orders: orders.map((o) => ({
        id: o.id,
        number: o.number,
        progress: o.progress,
        progressUpdatedAt: o.progressUpdatedAt?.toISOString() ?? null,
        progressEstimateMinutes: o.progressEstimateMinutes,
        occurredAt: o.occurredAt.toISOString(),
        customerName: o.customer?.name ?? o.customerName ?? "Cliente",
        notes: o.notes,
        paid:
          o.onlinePayment?.status === "RECEIVED" ||
          o.onlinePayment?.status === "CONFIRMED" ||
          o.status === "CONCLUIDA",
        items: o.items.map((i) => ({
          id: i.id,
          name: i.product?.name ?? i.combo?.name ?? "Item",
          quantity: Number(i.quantity),
          notes: i.notes,
        })),
      })),
    });
  } catch (e) {
    console.error("[/api/admin/kds]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado" },
      { status: 500 },
    );
  }
}
