import type { Metadata } from "next";
import { Clock, Package } from "lucide-react";
import { EncomendaClient } from "@/components/public/encomenda/EncomendaClient";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/server/services/public-menu.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fazer encomenda",
  description:
    "Encomende com antecedência pra retirar ou receber na data que você quiser.",
};

export default async function EncomendaPage() {
  const [products, combos, settings] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, showInMenu: true, salePrice: { gt: 0 } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        salePrice: true,
      },
    }),
    prisma.combo.findMany({
      where: { active: true, showInMenu: true, salePrice: { gt: 0 } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        salePrice: true,
      },
    }),
    getSiteSettings(),
  ]);

  const catalog = [
    ...products.map((p) => ({
      kind: "PRODUTO" as const,
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      priceCents: Math.round(Number(p.salePrice ?? 0) * 100),
    })),
    ...combos.map((c) => ({
      kind: "COMBO" as const,
      id: c.id,
      name: c.name,
      description: c.description,
      imageUrl: c.imageUrl,
      priceCents: Math.round(Number(c.salePrice ?? 0) * 100),
    })),
  ];

  // Antecedência mínima global (admin configura em Settings)
  const settingsRow = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { orderLeadTimeHours: true },
  });
  const leadHours = settingsRow?.orderLeadTimeHours ?? 48;

  return (
    <div className="space-y-6">
      <header className="space-y-3 rounded-xl border-2 border-roxa-200 bg-roxa-50/60 p-5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-roxa-700 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
          <Package className="h-3 w-3" />
          Encomenda
        </div>
        <h1 className="font-serif text-2xl font-bold text-roxa-900">
          Fazer uma encomenda
        </h1>
        <p className="text-sm text-slate-700">
          Aniversário, almoço de família, evento — escolha o que quer e
          combinamos a retirada ou entrega na data certa.
        </p>
        <p className="inline-flex items-center gap-1 text-xs text-roxa-800">
          <Clock className="h-3 w-3" />
          Pedido com pelo menos <strong>{leadHours}h</strong> de antecedência.
        </p>
      </header>

      <EncomendaClient
        catalog={catalog}
        leadHours={leadHours}
        deliveryEnabled={settings.deliveryEnabled}
        pickupEnabled={settings.pickupEnabled}
      />
    </div>
  );
}
