import Link from "next/link";
import {
  Carrot,
  Package,
  ClipboardList,
  Boxes,
  Calculator,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertsList } from "@/components/dashboard/AlertsList";
import { CmvByCategoryChart } from "@/components/dashboard/charts/CmvByCategoryChart";
import { CategoryDistributionChart } from "@/components/dashboard/charts/CategoryDistributionChart";
import { TopItemsChart } from "@/components/dashboard/charts/TopItemsChart";
import { getDashboardData } from "@/server/services/dashboard.service";
import { formatBRL, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboardData();

  const targetProductCmv = d.settings ? Number(d.settings.defaultCmvChicken) : 0.5;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`${d.settings?.businessName ?? "Casa Roxa"} — visão geral em tempo real.`}
      />

      {/* KPIs principais */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Ingredientes" value={String(d.counts.ingredients)} hint="ativos" />
        <KpiCard label="Produtos" value={String(d.counts.products)} hint="ativos" />
        <KpiCard label="Combos" value={String(d.counts.combos)} hint="ativos" />
        <KpiCard
          label="CMV médio produtos"
          value={d.avg.productCmv > 0 ? formatPercent(d.avg.productCmv) : "—"}
          tone={d.avg.productCmv > targetProductCmv ? "warning" : "success"}
          hint={`meta padrão ${formatPercent(targetProductCmv)}`}
        />
        <KpiCard
          label="CMV médio combos"
          value={d.avg.comboCmv > 0 ? formatPercent(d.avg.comboCmv) : "—"}
          tone={
            d.avg.comboCmv > Number(d.settings?.defaultCmvCombos ?? 0.45)
              ? "warning"
              : "success"
          }
          hint={`meta ${formatPercent(d.settings?.defaultCmvCombos ?? 0.45)}`}
        />
        <KpiCard
          label="Faturamento mensal alvo"
          value={formatBRL(d.monthlyRevenueTarget)}
          hint={`${d.settings?.targetOrdersPerWeekend ?? 0} ped × ${d.settings?.weekendsPerMonth ?? 4} fds`}
        />
        <KpiCard
          label="Custo fixo mensal"
          value={formatBRL(d.settings?.fixedMonthlyCost ?? 0)}
        />
        <KpiCard
          label="Ticket médio alvo"
          value={formatBRL(d.settings?.targetAverageTicket ?? 0)}
        />
        <KpiCard
          label="Movimentos de estoque"
          value={String(d.counts.stockMovementsLast30Days)}
          hint="últimos 30 dias"
        />
        <KpiCard
          label="Faturamento real (30d)"
          value={d.sales.revenue > 0 ? formatBRL(d.sales.revenue) : "—"}
          hint={`${d.counts.salesLast30Days} venda${d.counts.salesLast30Days === 1 ? "" : "s"} concluída${d.counts.salesLast30Days === 1 ? "" : "s"}`}
        />
        <KpiCard
          label="CMV real (30d)"
          value={d.sales.cmv !== null ? formatPercent(d.sales.cmv) : "—"}
          tone={
            d.sales.cmv !== null && d.sales.cmv > targetProductCmv
              ? "warning"
              : "success"
          }
          hint={d.sales.cmv !== null ? `${formatBRL(d.sales.cost)} de custo` : "sem vendas concluídas"}
        />
      </section>

      {/* Alertas + distribuição lado a lado */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AlertsList alerts={d.alerts} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produtos por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryDistributionChart data={d.charts.categoryDistribution} />
          </CardContent>
        </Card>
      </section>

      {/* CMV por categoria */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CMV médio por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <CmvByCategoryChart
              data={d.charts.cmvByCategory}
              defaultTarget={targetProductCmv}
            />
          </CardContent>
        </Card>
      </section>

      {/* Top lucros e top CMVs */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 — produtos mais lucrativos</CardTitle>
          </CardHeader>
          <CardContent>
            <TopItemsChart data={d.charts.topProductsByProfit} format="money" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 — produtos com maior CMV</CardTitle>
          </CardHeader>
          <CardContent>
            <TopItemsChart data={d.charts.topProductsByCmv} format="percent" color="warn" />
          </CardContent>
        </Card>
      </section>

      {/* Top combos por lucro */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 — combos mais lucrativos</CardTitle>
          </CardHeader>
          <CardContent>
            <TopItemsChart data={d.charts.topCombosByProfit} format="money" />
          </CardContent>
        </Card>
      </section>

      {/* Atalhos */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Ações rápidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <ShortcutLink href="/ingredientes/novo" icon={Carrot} label="Cadastrar ingrediente" />
          <ShortcutLink href="/produtos/novo" icon={Package} label="Cadastrar produto" />
          <ShortcutLink href="/fichas-tecnicas" icon={ClipboardList} label="Editar ficha" />
          <ShortcutLink href="/combos/novo" icon={Boxes} label="Criar combo" />
          <ShortcutLink href="/simulador" icon={Calculator} label="Simular preço" />
          <ShortcutLink href="/importar" icon={Upload} label="Importar planilha" />
        </div>
      </section>
    </div>
  );
}

function ShortcutLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 hover:border-roxa-300 hover:shadow-sm transition"
    >
      <div className="grid h-9 w-9 place-items-center rounded-md bg-roxa-50 text-roxa-700 group-hover:bg-roxa-100">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-slate-800">{label}</span>
    </Link>
  );
}
