import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PriceSimulator,
  type SimulatorTarget,
} from "@/components/simulator/PriceSimulator";
import {
  listRecentSimulations,
  listSimulationTargets,
} from "@/server/services/simulation.service";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatDateTime, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SimuladorPage() {
  const [{ products, combos }, recent, settings] = await Promise.all([
    listSimulationTargets(),
    listRecentSimulations(10),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  const productTargets: SimulatorTarget[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    totalCost: Number(p.totalCost),
    salePrice: p.salePrice ? Number(p.salePrice) : null,
    targetCmv: p.targetCmv ? Number(p.targetCmv) : null,
  }));
  const comboTargets: SimulatorTarget[] = combos.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    totalCost: Number(c.totalCost),
    salePrice: c.salePrice ? Number(c.salePrice) : null,
    targetCmv: c.targetCmv ? Number(c.targetCmv) : null,
  }));

  // Map de nomes para o histórico
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const comboNames = new Map(combos.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Simulador de Preços"
        description="Calcule preço sugerido pela meta de CMV e veja o efeito de taxa de cartão, app e desconto."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <PriceSimulator
            products={productTargets}
            combos={comboTargets}
            defaults={{
              cardFeePercent: settings ? Number(settings.cardFeePercent) : 0,
              appFeePercent: settings ? Number(settings.appFeePercent) : 0,
              targetCmvProducts: settings ? Number(settings.defaultCmvChicken) : 0.5,
              targetCmvCombos: settings ? Number(settings.defaultCmvCombos) : 0.45,
            }}
          />
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Simulações recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhuma simulação salva ainda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((s) => {
                    const name =
                      s.productId
                        ? productNames.get(s.productId)
                        : s.comboId
                          ? comboNames.get(s.comboId)
                          : null;
                    return (
                      <li
                        key={s.id}
                        className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-slate-700">
                            {name ?? (s.targetType === "PRODUTO" ? "Produto" : "Combo")}
                          </span>
                          <span className="text-slate-400">
                            {formatDateTime(s.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-x-2 tabular-nums text-slate-600">
                          <span>Custo: {formatBRL(s.currentCost)}</span>
                          <span>Sim: {formatBRL(s.simulatedPrice)}</span>
                          <span>Meta: {formatPercent(s.targetCmv)}</span>
                          <span>CMV: {formatPercent(s.simulatedCmv)}</span>
                        </div>
                        {s.notes && (
                          <p className="mt-1 italic text-slate-500">“{s.notes}”</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
