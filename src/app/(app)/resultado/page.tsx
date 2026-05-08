import { TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DreTable } from "@/components/financial/DreTable";
import { ResultHistoryChart } from "@/components/financial/ResultHistoryChart";
import { PeriodFilter } from "@/components/financial/PeriodFilter";
import {
  getDreForPeriod,
  getDreLastMonths,
  parsePeriodFromParams,
} from "@/server/services/financial.service";
import { formatBRL, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ResultadoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const fromStr = typeof sp.from === "string" ? sp.from : undefined;
  const toStr = typeof sp.to === "string" ? sp.to : undefined;

  const { from, to } = parsePeriodFromParams({ from: fromStr, to: toStr });
  const [dre, history] = await Promise.all([
    getDreForPeriod(from, to),
    getDreLastMonths(6),
  ]);

  const isPositive = dre.operatingResult >= 0;
  const tone = isPositive ? "success" : "danger";

  // Para o input "from"/"to" no client (ISO yyyy-mm-dd)
  const fromIso = from.toISOString().slice(0, 10);
  const toIso = to.toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Resultado / DRE"
        description="Demonstrativo financeiro consolidado: receita das vendas concluídas, custos diretos via ficha técnica e custos fixos com pro-rata por dias."
        actions={
          <Badge tone={tone}>
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {isPositive ? "Resultado positivo" : "Resultado negativo"}
          </Badge>
        }
      />

      <Card>
        <CardContent className="p-4">
          <PeriodFilter defaultFrom={fromIso} defaultTo={toIso} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">DRE do período</CardTitle>
            </CardHeader>
            <CardContent>
              <DreTable dre={dre} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Resultado operacional
              </p>
              <p
                className={`mt-1 text-3xl font-semibold tabular-nums ${
                  isPositive ? "text-green-700" : "text-red-600"
                }`}
              >
                {formatBRL(dre.operatingResult)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {dre.netRevenue > 0
                  ? `${formatPercent(dre.operatingResultPct)} da receita líquida`
                  : "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Operacional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Row
                label="Vendas concluídas"
                value={String(dre.salesCount)}
              />
              <Row
                label="Ticket médio"
                value={dre.salesCount > 0 ? formatBRL(dre.avgTicket) : "—"}
              />
              <Row
                label="Período"
                value={`${dre.days} dia${dre.days === 1 ? "" : "s"}`}
              />
              <Row
                label="CMV real"
                value={dre.revenue > 0 ? formatPercent(dre.cmvPct) : "—"}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado mês a mês (últimos 6)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResultHistoryChart
            data={history.map((m) => ({
              monthLabel: m.monthLabel,
              operatingResult: m.operatingResult,
              revenue: m.revenue,
              cogs: m.cogs,
              fixedCosts: m.fixedCosts,
            }))}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500">
        Custos fixos entram pro-rata: <code>custo mensal × (dias do período / 30)</code>.
        Para mês fechado o valor coincide com o cadastro em /custos-fixos.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700 tabular-nums">{value}</span>
    </div>
  );
}
