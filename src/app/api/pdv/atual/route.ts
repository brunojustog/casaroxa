import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHOD_LABEL } from "@/lib/enums";

export const dynamic = "force-dynamic";

/**
 * Venda atual do caixa (PDV) pra tela do cliente:
 *  - venda LOJA ABERTA mais recente (em andamento), ou
 *  - venda LOJA concluída nos últimos 90s (tela de "obrigado" com troco), ou
 *  - null (tela de espera).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const select = {
    id: true,
    number: true,
    status: true,
    totalRevenue: true,
    totalPaid: true,
    totalDiscount: true,
    updatedAt: true,
    items: {
      orderBy: { createdAt: "asc" as const },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        totalPrice: true,
        product: { select: { name: true } },
        combo: { select: { name: true } },
      },
    },
    payments: {
      orderBy: { createdAt: "asc" as const },
      select: {
        id: true,
        method: true,
        amount: true,
        receivedAmount: true,
      },
    },
  };

  let sale = await prisma.sale.findFirst({
    where: { source: "LOJA", status: "ABERTA" },
    orderBy: { updatedAt: "desc" },
    select,
  });

  if (!sale) {
    sale = await prisma.sale.findFirst({
      where: {
        source: "LOJA",
        status: "CONCLUIDA",
        closedAt: { gte: new Date(Date.now() - 90_000) },
      },
      orderBy: { closedAt: "desc" },
      select,
    });
  }

  if (!sale) return NextResponse.json({ sale: null });

  const troco = sale.payments.reduce((acc, p) => {
    const received = p.receivedAmount ? Number(p.receivedAmount) : 0;
    const diff = received - Number(p.amount);
    return acc + (diff > 0 ? diff : 0);
  }, 0);

  return NextResponse.json({
    sale: {
      id: sale.id,
      number: sale.number,
      status: sale.status,
      total: Number(sale.totalRevenue),
      totalPaid: Number(sale.totalPaid),
      // Em venda ABERTA o cache totalDiscount é só "falta pagar" — desconto
      // de verdade só existe depois do fechamento.
      discount: sale.status === "CONCLUIDA" ? Number(sale.totalDiscount) : 0,
      troco,
      updatedAt: sale.updatedAt,
      items: sale.items.map((it) => ({
        id: it.id,
        name: it.product?.name ?? it.combo?.name ?? "Item",
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        totalPrice: Number(it.totalPrice),
      })),
      payments: sale.payments.map((p) => ({
        id: p.id,
        method: p.method,
        label: PAYMENT_METHOD_LABEL[p.method],
        amount: Number(p.amount),
        receivedAmount: p.receivedAmount ? Number(p.receivedAmount) : null,
      })),
    },
  });
}
