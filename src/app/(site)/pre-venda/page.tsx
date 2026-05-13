import { redirect } from "next/navigation";
import { CalendarDays, Clock } from "lucide-react";
import { getActiveSalesEvent } from "@/server/services/sales-event.service";
import { getSiteSettings } from "@/server/services/public-menu.service";
import { PreSaleClient } from "@/components/public/pre-sale/PreSaleClient";

export const dynamic = "force-dynamic";

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export default async function PreVendaPublicPage() {
  const [event, settings] = await Promise.all([
    getActiveSalesEvent(),
    getSiteSettings(),
  ]);

  if (!event) {
    redirect("/cardapio");
  }

  const items = event.products.map((p) => {
    const name = p.product?.name ?? p.combo?.name ?? "Item";
    const description =
      p.product?.description ?? p.combo?.description ?? null;
    const imageUrl = p.product?.imageUrl ?? p.combo?.imageUrl ?? null;
    const defaultPrice = Number(p.product?.salePrice ?? p.combo?.salePrice ?? 0);
    const priceCents =
      p.unitPriceCents !== null && p.unitPriceCents !== undefined
        ? p.unitPriceCents
        : Math.round(defaultPrice * 100);
    return {
      sepId: p.id,
      kind: p.product ? ("PRODUTO" as const) : ("COMBO" as const),
      id: (p.productId ?? p.comboId)!,
      name,
      description,
      imageUrl,
      priceCents,
      quantityLimit: p.quantityLimit,
      reservedQty: p.reservedQty,
    };
  });

  return (
    <div className="space-y-6">
      <header className="space-y-3 rounded-xl border-2 border-roxa-200 bg-roxa-50/60 p-5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-roxa-700 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
          <CalendarDays className="h-3 w-3" />
          Pré-venda
        </div>
        <h1 className="font-serif text-2xl font-bold text-roxa-900">
          {event.name}
        </h1>
        {event.description && (
          <p className="text-sm text-slate-700 whitespace-pre-line">
            {event.description}
          </p>
        )}
        <p className="inline-flex items-center gap-1 text-xs text-roxa-800">
          <Clock className="h-3 w-3" />
          Inscrições até <strong>{fmtDateTime(event.closesAt)}</strong>
        </p>
      </header>

      <PreSaleClient
        eventId={event.id}
        items={items}
        windows={event.windows.map((w) => ({
          id: w.id,
          kind: w.kind,
          label: w.label,
          startsAt: w.startsAt.toISOString(),
          endsAt: w.endsAt.toISOString(),
          capacity: w.capacity,
          reservedCount: w.reservedCount,
        }))}
        whatsappNumber={settings.whatsappNumber}
      />
    </div>
  );
}
