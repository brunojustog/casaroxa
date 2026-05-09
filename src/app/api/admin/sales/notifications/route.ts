/**
 * GET /api/admin/sales/notifications
 *
 * Endpoint protegido (requireAuth) chamado por polling do bell no header.
 * Retorna { count, latest: [...] } de pedidos do site (source=SITE) ainda
 * em progress=NOVO. Usado pra mostrar badge + dropdown de "novos pedidos".
 *
 * Mantém leve: limit 10 latest, sem includes pesados.
 */
import { NextResponse } from "next/server";
import { getNewSiteOrders } from "@/server/services/sales.service";
import {
  UnauthorizedError,
  requireAuth,
} from "@/server/auth-helpers";

export async function GET() {
  try {
    await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado." },
        { status: 401 },
      );
    }
    throw e;
  }

  const orders = await getNewSiteOrders(10);
  return NextResponse.json({
    ok: true,
    count: orders.length,
    latest: orders.map((o) => ({
      id: o.id,
      number: o.number,
      customerName: o.customerName,
      total: Number(o.totalRevenue),
      itemCount: o._count.items,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
