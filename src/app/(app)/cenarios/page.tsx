import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { ScenarioRowActions } from "@/components/scenarios/ScenarioRowActions";
import { listScenarios } from "@/server/services/scenario.service";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CenariosPage() {
  const [scenarios, settings] = await Promise.all([
    listScenarios(),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  const totalInvestment = settings
    ? Number(settings.investedAmount) + Number(settings.plannedInvestment)
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cenários de Faturamento"
        description="Compare cenários de pedidos × ticket × CMV. Use para projetar resultado mensal e payback."
        actions={
          <Link
            href="/cenarios/novo"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Novo cenário
          </Link>
        }
      />

      {scenarios.length === 0 ? (
        <EmptyState>
          Você ainda não tem cenários.{" "}
          <Link href="/cenarios/novo" className="text-roxa-700 hover:underline">
            Criar o primeiro
          </Link>{" "}
          (sugestões: Conservador, Meta, Excelente).
        </EmptyState>
      ) : (
        <>
          {/* Cards individuais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((s) => (
              <Card key={s.id}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <ScenarioRowActions id={s.id} />
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Pedidos / FdS" value={String(s.ordersPerWeekend)} />
                  <Row label="Ticket médio" value={formatBRL(s.averageTicket)} />
                  <Row label="FdS / mês" value={String(s.weekendsPerMonth)} />
                  <Row
                    label="CMV estimado"
                    value={formatPercent(s.estimatedCmvPercent)}
                  />
                  <hr className="my-2 border-slate-100" />
                  <Row label="Faturamento mensal" value={formatBRL(s.monthlyRevenue)} bold />
                  <Row label="Lucro bruto" value={formatBRL(s.grossProfit)} />
                  <Row label="Custo fixo" value={formatBRL(s.fixedCost)} muted />
                  <Row
                    label="Resultado mensal"
                    value={formatBRL(s.estimatedResult)}
                    bold
                    accent={Number(s.estimatedResult) > 0 ? "ok" : "warning"}
                  />
                  <Row
                    label="Payback"
                    value={
                      s.paybackMonths
                        ? `${Number(s.paybackMonths).toFixed(1)} meses`
                        : "—"
                    }
                    muted
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparação tabular */}
          {scenarios.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Comparação lado a lado</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2 text-left">Métrica</th>
                      {scenarios.map((s) => (
                        <th key={s.id} className="px-4 py-2 text-right">
                          {s.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <Tr label="Pedidos por fim de semana">
                      {scenarios.map((s) => (
                        <td key={s.id} className="px-4 py-2 text-right tabular-nums">
                          {s.ordersPerWeekend}
                        </td>
                      ))}
                    </Tr>
                    <Tr label="Ticket médio">
                      {scenarios.map((s) => (
                        <td key={s.id} className="px-4 py-2 text-right tabular-nums">
                          {formatBRL(s.averageTicket)}
                        </td>
                      ))}
                    </Tr>
                    <Tr label="CMV estimado">
                      {scenarios.map((s) => (
                        <td key={s.id} className="px-4 py-2 text-right tabular-nums">
                          {formatPercent(s.estimatedCmvPercent)}
                        </td>
                      ))}
                    </Tr>
                    <Tr label="Faturamento mensal" bold>
                      {scenarios.map((s) => (
                        <td key={s.id} className="px-4 py-2 text-right tabular-nums font-semibold">
                          {formatBRL(s.monthlyRevenue)}
                        </td>
                      ))}
                    </Tr>
                    <Tr label="Lucro bruto">
                      {scenarios.map((s) => (
                        <td key={s.id} className="px-4 py-2 text-right tabular-nums">
                          {formatBRL(s.grossProfit)}
                        </td>
                      ))}
                    </Tr>
                    <Tr label="Custo fixo">
                      {scenarios.map((s) => (
                        <td key={s.id} className="px-4 py-2 text-right tabular-nums text-slate-500">
                          {formatBRL(s.fixedCost)}
                        </td>
                      ))}
                    </Tr>
                    <Tr label="Resultado mensal" bold>
                      {scenarios.map((s) => (
                        <td
                          key={s.id}
                          className={`px-4 py-2 text-right tabular-nums font-semibold ${
                            Number(s.estimatedResult) > 0
                              ? "text-green-700"
                              : "text-orange-700"
                          }`}
                        >
                          {formatBRL(s.estimatedResult)}
                        </td>
                      ))}
                    </Tr>
                    <Tr label="Payback">
                      {scenarios.map((s) => (
                        <td key={s.id} className="px-4 py-2 text-right tabular-nums">
                          {s.paybackMonths
                            ? `${Number(s.paybackMonths).toFixed(1)} meses`
                            : "—"}
                        </td>
                      ))}
                    </Tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <p className="text-xs text-slate-400">
        Investimento total considerado nos cálculos de payback:{" "}
        <strong>{formatBRL(totalInvestment)}</strong> · Custo fixo mensal:{" "}
        <strong>{formatBRL(settings?.fixedMonthlyCost ?? 0)}</strong> (vem de{" "}
        <Link href="/configuracoes" className="text-roxa-700 hover:underline">
          /configuracoes
        </Link>
        ).
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  bold = false,
  muted = false,
  accent = "neutral",
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  accent?: "ok" | "warning" | "neutral";
}) {
  const valueColor =
    accent === "ok"
      ? "text-green-700"
      : accent === "warning"
        ? "text-orange-700"
        : muted
          ? "text-slate-500"
          : "text-slate-900";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500 text-xs">{label}</span>
      <span
        className={`tabular-nums ${bold ? "font-semibold" : ""} ${valueColor}`}
      >
        {value}
      </span>
    </div>
  );
}

function Tr({
  label,
  children,
  bold = false,
}: {
  label: string;
  children: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <tr>
      <td className={`px-4 py-2 text-slate-700 ${bold ? "font-semibold" : ""}`}>
        {label}
      </td>
      {children}
    </tr>
  );
}
