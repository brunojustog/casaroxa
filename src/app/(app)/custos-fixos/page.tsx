import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { FixedCostCategory } from "@prisma/client";
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
import { FixedCostRowActions } from "@/components/fixed-costs/FixedCostRowActions";
import {
  ensureLegacyFixedCostMigrated,
  getMonthlyTotal,
  getSummaryByCategory,
  listFixedCostItems,
} from "@/server/services/fixed-costs.service";
import { fixedCostListFiltersSchema } from "@/schemas/fixed-cost.schema";
import {
  FIXED_COST_CATEGORY_LABEL,
  FIXED_COST_FREQUENCY_LABEL,
  enumOptions,
} from "@/lib/enums";
import { formatBRL } from "@/lib/format";
import { monthlyEquivalent } from "@/domain/fixed-costs";

export const dynamic = "force-dynamic";

const CATEGORY_OPTIONS = enumOptions(FIXED_COST_CATEGORY_LABEL);

export default async function CustosFixosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await ensureLegacyFixedCostMigrated();

  const params = await searchParams;
  const filters = fixedCostListFiltersSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    category:
      typeof params.category === "string" ? params.category : "all",
    active: typeof params.active === "string" ? params.active : "active",
  });

  const [items, monthlyTotal, summary] = await Promise.all([
    listFixedCostItems(filters),
    getMonthlyTotal(),
    getSummaryByCategory(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Custos Fixos"
        description="Componentes do custo fixo mensal. A soma dos itens ativos alimenta cenários, simulador e dashboard."
        actions={
          <Link
            href="/custos-fixos/novo"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Novo item
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Total mensal
            </p>
            <p className="mt-1 text-3xl font-semibold text-slate-900 tabular-nums">
              {formatBRL(monthlyTotal)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Soma dos itens ativos. Anuais entram com /12.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">
              Por categoria
            </p>
            {summary.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum item ativo.</p>
            ) : (
              <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                {summary
                  .slice()
                  .sort((a, b) => b.monthlyTotal - a.monthlyTotal)
                  .map((s) => (
                    <li key={s.category} className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-1">
                      <span className="text-slate-600">
                        {FIXED_COST_CATEGORY_LABEL[s.category]}
                        <span className="ml-1 text-xs text-slate-400">
                          ({s.itemCount})
                        </span>
                      </span>
                      <span className="font-medium text-slate-900 tabular-nums">
                        {formatBRL(s.monthlyTotal)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/custos-fixos">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="Buscar por nome ou observação…"
            className="pl-8 w-72"
          />
        </div>
        <Select name="category" defaultValue={filters.category} className="w-52">
          <option value="all">Todas as categorias</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select name="active" defaultValue={filters.active} className="w-36">
          <option value="active">Apenas ativos</option>
          <option value="inactive">Apenas inativos</option>
          <option value="all">Todos</option>
        </Select>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState>
          Nenhum item encontrado.{" "}
          <Link href="/custos-fixos/novo" className="text-roxa-700 hover:underline">
            Cadastrar o primeiro
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Item</TH>
              <TH>Categoria</TH>
              <TH>Frequência</TH>
              <TH className="text-right">Valor</TH>
              <TH className="text-right">Mensal equivalente</TH>
              <TH>Status</TH>
              <TH className="text-right pr-4">Ações</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((it) => {
              const monthly = monthlyEquivalent(it.amount, it.frequency);
              return (
                <TR key={it.id}>
                  <TD className="font-medium text-slate-900">
                    <Link
                      href={`/custos-fixos/${it.id}`}
                      className="hover:text-roxa-700"
                    >
                      {it.name}
                    </Link>
                    {it.notes && (
                      <p className="text-xs text-slate-500 mt-0.5">{it.notes}</p>
                    )}
                  </TD>
                  <TD className="text-slate-600">
                    {FIXED_COST_CATEGORY_LABEL[it.category as FixedCostCategory]}
                  </TD>
                  <TD className="text-slate-600 text-xs">
                    {FIXED_COST_FREQUENCY_LABEL[it.frequency]}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatBRL(it.amount)}
                  </TD>
                  <TD className="text-right tabular-nums font-medium text-slate-900">
                    {formatBRL(monthly)}
                  </TD>
                  <TD>
                    {it.active ? (
                      <Badge tone="success">Ativo</Badge>
                    ) : (
                      <Badge tone="neutral">Inativo</Badge>
                    )}
                  </TD>
                  <TD className="text-right pr-2">
                    <FixedCostRowActions id={it.id} active={it.active} />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {items.length} item{items.length === 1 ? "" : "ns"}
      </div>
    </div>
  );
}
