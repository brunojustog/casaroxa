import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublicSaleTracking,
} from "@/server/services/sales.service";
import { getSiteSettings } from "@/server/services/public-menu.service";
import { OrderTrackingClient } from "@/components/public/OrderTrackingClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const sale = await getPublicSaleTracking(id);
  if (!sale) return { title: "Pedido não encontrado", robots: { index: false } };
  return {
    title: `Pedido #${sale.number}`,
    description: `Acompanhe o andamento do pedido #${sale.number}.`,
    robots: { index: false, follow: false }, // tracking é privado por natureza
  };
}

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sale, settings] = await Promise.all([
    getPublicSaleTracking(id),
    getSiteSettings(),
  ]);
  if (!sale) notFound();

  return (
    <OrderTrackingClient
      saleId={id}
      whatsappNumber={settings.whatsappNumber}
      initialData={{
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
      }}
    />
  );
}
