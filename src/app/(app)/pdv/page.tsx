import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PdvClient, type PdvSale } from "@/components/sales/PdvClient";
import {
  getCurrentPdvSale,
  listActiveCombosForSale,
  listActiveProductsForSale,
} from "@/server/services/sales.service";

export const dynamic = "force-dynamic";

export default async function PdvPage() {
  const [sale, products, combos] = await Promise.all([
    getCurrentPdvSale(),
    listActiveProductsForSale(),
    listActiveCombosForSale(),
  ]);

  const catalog = [
    ...products.map((p) => ({
      kind: "PRODUTO" as const,
      id: p.id,
      name: p.name,
      salePrice: Number(p.salePrice ?? 0),
      scaleCode: p.scaleCode,
      barcode: p.barcode,
    })),
    ...combos.map((c) => ({
      kind: "COMBO" as const,
      id: c.id,
      name: c.name,
      salePrice: Number(c.salePrice ?? 0),
      scaleCode: null,
      barcode: null,
    })),
  ];

  const pdvSale: PdvSale | null = sale
    ? {
        id: sale.id,
        number: sale.number,
        total: Number(sale.totalRevenue),
        totalPaid: Number(sale.totalPaid),
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
          amount: Number(p.amount),
          receivedAmount: p.receivedAmount ? Number(p.receivedAmount) : null,
        })),
      }
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="PDV — Caixa"
        description={
          pdvSale
            ? `Venda #${pdvSale.number} em andamento`
            : "Bipe, receba e conclua — sem burocracia."
        }
        actions={
          <Link
            href="/pdv-cliente"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-roxa-300 hover:text-roxa-700"
            title="Abra no monitor voltado pro cliente (F11 pra tela cheia)"
          >
            <MonitorSmartphone className="h-4 w-4" />
            Tela do cliente
          </Link>
        }
      />
      <PdvClient sale={pdvSale} catalog={catalog} />
    </div>
  );
}
