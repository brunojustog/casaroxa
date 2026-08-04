import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { SaleSource, SaleStatus } from "@prisma/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import {
  getRevenueLast30Days,
  listSales,
  sumPaymentsByMethod,
} from "@/server/services/sales.service";
import { saleListFiltersSchema } from "@/schemas/sale.schema";
import {
  PAYMENT_METHOD_LABEL,
  SALE_SOURCE_LABEL,
  SALE_STATUS_LABEL,
  enumOptions,
} from "@/lib/enums";
import { formatBRL, formatDateTime, formatPercent } from "@/lib/format";
import { ReprintCupomButton } from "@/components/sales/ReprintCupomButton";

export const dynamic = "force-dynamic";

const SOURCE_OPTIONS = enumOptions(SALE_SOURCE_LABEL);
const STATUS_OPTIONS = enumOptions(SALE_STATUS_LABEL);
const PAYMENT_OPTIONS = enumOptions(PAYMENT_METHOD_LABEL);

function statusTone(status: SaleStatus) {
  switch (status) {
    case "CONCLUIDA":
      return "success" as const;
    case "ABERTA":
      return "info" as const;
    case "CANCELADA":
      return "neutral" as const;
  }
}

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = saleListFiltersSchema.parse({
    status: typeof params.status === "string" ? params.status : "all",
    source: typeof params.source === "string" ? params.source : "all",
    payment: typeof params.payment === "string" ? params.payment : "all",
    from: typeof params.from === "string" ? params.from : undefined,
    to: typeof params.to === "string" ? params.to : undefined,
    search: typeof params.search === "string" ? params.search : undefined,
  });

  const [sales, last30, paymentTotals] = await Promise.all([
    listSales(filters, 200),
    getRevenueLast30Days(),
    sumPaymentsByMethod(filters),
  ]);
  const totalRecebido = paymentTotals.reduce((a, p) => a + p.total, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendas"
        description="Lançamento venda-a-venda com pagamentos e taxas. Conclusão desconta o estoque automaticamente via ficha técnica."
        actions={
          <Link
            href="/vendas/nova"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Nova venda
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Faturamento (30d)
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
              {formatBRL(last30.revenue)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {last30.count} venda{last30.count === 1 ? "" : "s"} concluída{last30.count === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Receita líquida (30d)
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
              {formatBRL(last30.net)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Após taxas de cartão/app</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              CMV real (30d)
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
              {last30.cmv !== null ? formatPercent(last30.cmv) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatBRL(last30.cost)} de custo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Total de vendas
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
              {sales.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">No filtro atual</p>
          </CardContent>
        </Card>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/vendas">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="Cliente ou observação…"
            className="pl-8 w-60"
          />
        </div>
        <Select name="status" defaultValue={filters.status} className="w-40">
          <option value="all">Todos status</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select name="source" defaultValue={filters.source} className="w-36">
          <option value="all">Todas origens</option>
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select name="payment" defaultValue={filters.payment} className="w-40">
          <option value="all">Todos pagamentos</option>
          {PAYMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input type="date" name="from" defaultValue={filters.from ?? ""} className="w-40" />
        <Input type="date" name="to" defaultValue={filters.to ?? ""} className="w-40" />
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {paymentTotals.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                💰 Recebido por forma de pagamento
                <span className="ml-2 normal-case tracking-normal text-slate-400">
                  (vendas concluídas no período filtrado — filtre a data pro fechamento do dia)
                </span>
              </p>
              <p className="text-sm text-slate-600">
                Total: <span className="font-semibold text-slate-900 tabular-nums">{formatBRL(totalRecebido)}</span>
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {paymentTotals.map((p) => (
                <span
                  key={p.method}
                  className="inline-flex items-baseline gap-2 rounded-lg border border-roxa-100 bg-roxa-50 px-3 py-2"
                >
                  <span className="text-xs font-medium text-roxa-800">
                    {PAYMENT_METHOD_LABEL[p.method]}
                  </span>
                  <span className="text-base font-semibold tabular-nums text-roxa-900">
                    {formatBRL(p.total)}
                  </span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sales.length === 0 ? (
        <EmptyState>
          Nenhuma venda encontrada.{" "}
          <Link href="/vendas/nova" className="text-roxa-700 hover:underline">
            Lançar a primeira
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH className="w-16">#</TH>
              <TH>Data</TH>
              <TH>Origem</TH>
              <TH>Cliente</TH>
              <TH className="text-center">Itens</TH>
              <TH className="text-right">Bruto</TH>
              <TH className="text-right">Líquido</TH>
              <TH>Status</TH>
              <TH className="w-10"> </TH>
            </TR>
          </THead>
          <TBody>
            {sales.map((s) => (
              <TR key={s.id}>
                <TD className="text-slate-500 tabular-nums text-xs">#{s.number}</TD>
                <TD className="text-slate-700 text-xs">
                  <Link href={`/vendas/${s.id}`} className="hover:text-roxa-700">
                    {formatDateTime(s.occurredAt)}
                  </Link>
                </TD>
                <TD className="text-slate-600 text-xs">
                  {SALE_SOURCE_LABEL[s.source as SaleSource]}
                </TD>
                <TD className="text-slate-700">{s.customerName ?? "—"}</TD>
                <TD className="text-center text-slate-700 tabular-nums">
                  {s._count.items}
                </TD>
                <TD className="text-right tabular-nums">{formatBRL(s.totalRevenue)}</TD>
                <TD className="text-right tabular-nums font-medium text-slate-900">
                  {formatBRL(s.totalNet)}
                </TD>
                <TD>
                  <Badge tone={statusTone(s.status as SaleStatus)}>
                    {SALE_STATUS_LABEL[s.status as SaleStatus]}
                  </Badge>
                </TD>
                <TD>
                  {s.status !== "CANCELADA" && (
                    <ReprintCupomButton saleId={s.id} compact />
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        Mostrando {sales.length} venda{sales.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
