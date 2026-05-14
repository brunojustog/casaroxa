import { redirect } from "next/navigation";
import { ChefHat, ShoppingCart, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/producao/PrintButton";
import { getProductionPlanForDate } from "@/server/services/production.service";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

const UNIT_LABEL: Record<string, string> = {
  KG: "kg",
  G: "g",
  UNIDADE: "un",
  PACOTE: "pct",
  LITRO: "L",
  ML: "ml",
  PORCAO: "porção",
  BOTIJAO: "botijão",
  CAIXA: "cx",
};

const fmtCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);

const fmtDate = (dateISO: string) => {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
};

const fmtQty = (n: number) => {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
};

function nextSaturdayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSat);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function ProducaoPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const dateISO = sp.date ?? nextSaturdayISO();
  const plan = await getProductionPlanForDate(dateISO);

  const isEmpty =
    plan.productionList.length === 0 && plan.shoppingList.length === 0;

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="print:hidden">
        <PageHeader
          title="Planejamento de produção"
          description={`Pedidos confirmados para ${fmtDate(dateISO)}.`}
          actions={
            <form className="flex items-center gap-2">
              <label className="text-xs text-slate-600" htmlFor="date">
                Data:
              </label>
              <input
                type="date"
                id="date"
                name="date"
                defaultValue={dateISO}
                className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1 rounded-md bg-roxa-700 px-3 text-sm font-semibold text-white hover:bg-roxa-800"
              >
                Ver
              </button>
            </form>
          }
        />
      </div>

      {/* Header de impressão */}
      <div className="hidden print:block">
        <h1 className="font-serif text-2xl font-bold">
          Plano de produção — {fmtDate(dateISO)}
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          {plan.summary.preSaleCount} pré-venda(s) ·{" "}
          {plan.summary.orderRequestCount} encomenda(s) · custo estimado{" "}
          {fmtCurrency(plan.summary.totalCostCents)}
        </p>
      </div>

      {/* Botões de ação */}
      <div className="flex items-center gap-3 print:hidden">
        <PrintButton />
        <div className="text-xs text-slate-500">
          {plan.summary.preSaleCount} pré-venda(s) · {plan.summary.orderRequestCount}{" "}
          encomenda(s)
        </div>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="p-10 text-center text-slate-600">
            <AlertTriangle className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-900">
              Nada confirmado pra {fmtDate(dateISO)}
            </p>
            <p className="mt-1 text-sm">
              Não há pré-vendas (status OPEN/CLOSED com essa data) nem
              encomendas aprovadas pra esse dia.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print:grid-cols-2 print:gap-3">
          {/* Lista de produção */}
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <ChefHat className="h-4 w-4 text-roxa-700" /> Lista de produção
              </CardTitle>
            </CardHeader>
            <CardContent>
              {plan.productionList.length === 0 ? (
                <p className="text-sm text-slate-500">Sem itens pra produzir.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {plan.productionList.map((it) => (
                    <li
                      key={`${it.kind}-${it.id}`}
                      className="flex items-start gap-3 py-2.5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-roxa-100 text-sm font-bold text-roxa-800 tabular-nums">
                        {it.quantity}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900">{it.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                          {it.kind === "COMBO" && (
                            <Badge tone="default" className="text-[10px]">
                              Combo
                            </Badge>
                          )}
                          {it.sources.fromPreSale > 0 && (
                            <span>Pré-venda: {it.sources.fromPreSale}</span>
                          )}
                          {it.sources.fromPreSale > 0 &&
                            it.sources.fromEncomenda > 0 && <span>·</span>}
                          {it.sources.fromEncomenda > 0 && (
                            <span>Encomenda: {it.sources.fromEncomenda}</span>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Lista de compras */}
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center justify-between gap-2 text-base">
                <span className="inline-flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-roxa-700" /> Lista de compras
                </span>
                <span className="text-xs font-normal text-slate-600 tabular-nums">
                  {fmtCurrency(plan.summary.totalCostCents)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {plan.shoppingList.length === 0 ? (
                <div className="space-y-2 text-sm text-slate-500">
                  <p>Sem ingredientes derivados.</p>
                  <p className="text-xs">
                    Verifique se os produtos da lista de produção têm ficha
                    técnica cadastrada.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {plan.shoppingList.map((ing) => (
                    <li key={ing.ingredientId} className="py-2.5">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">
                            {ing.ingredientName}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {ing.breakdown
                              .map((b) => `${fmtQty(b.quantity)} ${UNIT_LABEL[ing.unit] ?? ing.unit} de ${b.source}`)
                              .join(" + ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 tabular-nums">
                            {fmtQty(ing.totalQuantity)} {UNIT_LABEL[ing.unit] ?? ing.unit}
                          </p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {fmtCurrency(ing.estimatedCostCents)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-[11px] text-slate-400 print:hidden">
        Fonte: pré-vendas (OPEN/CLOSED) com data do evento e encomendas
        (APROVADA/EM_PRODUCAO/PRONTA) com data desejada nesse dia. Vendas
        avulsas não entram no plano — elas são tratadas no KDS.
      </p>
    </div>
  );
}
