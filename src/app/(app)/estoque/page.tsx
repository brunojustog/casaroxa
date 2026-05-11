import Link from "next/link";
import { Plus, AlertTriangle, PackageX, Calendar, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import { StockFilters } from "@/components/stock/StockFilters";
import { listStockOverview } from "@/server/services/stock.service";
import { stockListFiltersSchema } from "@/schemas/stock.schema";
import {
  INGREDIENT_CATEGORY_LABEL,
  INGREDIENT_UNIT_LABEL,
} from "@/lib/enums";
import { formatBRL, formatDate, formatNumber } from "@/lib/format";
import type { IngredientCategory, IngredientUnit } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = stockListFiltersSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    filter:
      typeof params.filter === "string" &&
      ["all", "expiring", "empty", "below_min"].includes(params.filter)
        ? (params.filter as "all" | "expiring" | "empty" | "below_min")
        : "all",
  });

  const rows = await listStockOverview(filters);

  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Estoque"
        description="Saldo atual e movimentação de cada ingrediente. Saldo é calculado a partir dos lançamentos (entradas, saídas, perdas, ajustes)."
        actions={
          <Link
            href="/estoque/lancar"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Lançar movimento
          </Link>
        }
      />

      <StockFilters />

      {rows.length === 0 ? (
        <EmptyState>
          {filters.filter === "expiring"
            ? "Nenhum ingrediente com validade próxima nos próximos 7 dias."
            : filters.filter === "empty"
              ? "Nenhum ingrediente em uso está com saldo zerado."
              : filters.filter === "below_min"
                ? "Nenhum ingrediente abaixo do estoque mínimo configurado."
                : "Nenhum ingrediente encontrado."}
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Ingrediente</TH>
              <TH>Categoria</TH>
              <TH className="text-right">Saldo atual</TH>
              <TH className="text-right">Mínimo</TH>
              <TH className="text-right">Custo unit.</TH>
              <TH className="text-right">Valor em estoque</TH>
              <TH>Próx. validade</TH>
              <TH>Última mov.</TH>
              <TH className="text-right pr-4">Ações</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const expiresSoon = r.nextExpiryDate && r.nextExpiryDate <= sevenDays;
              const expired = r.nextExpiryDate && r.nextExpiryDate < now;
              const isEmpty = r.balance <= 0;
              return (
                <TR key={r.id}>
                  <TD className="font-medium text-slate-900">
                    <Link href={`/estoque/${r.id}`} className="hover:text-roxa-700">
                      {r.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {INGREDIENT_UNIT_LABEL[r.unit as IngredientUnit]}
                    </p>
                  </TD>
                  <TD>
                    {INGREDIENT_CATEGORY_LABEL[r.category as IngredientCategory]}
                  </TD>
                  <TD className="text-right tabular-nums">
                    <span
                      className={
                        isEmpty
                          ? "text-red-700 font-semibold"
                          : r.belowMin
                            ? "text-amber-700 font-semibold"
                            : "text-slate-900 font-medium"
                      }
                    >
                      {formatNumber(r.balance)}
                    </span>{" "}
                    <span className="text-xs text-slate-400">
                      {INGREDIENT_UNIT_LABEL[r.unit as IngredientUnit]}
                    </span>
                  </TD>
                  <TD className="text-right tabular-nums">
                    {r.minStock !== null && r.minStock > 0 ? (
                      <span className="text-xs text-slate-500">
                        {formatNumber(r.minStock)}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </TD>
                  <TD className="text-right tabular-nums text-slate-500">
                    {formatBRL(r.unitCost)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {r.balance > 0 ? formatBRL(r.balance * r.unitCost) : "—"}
                  </TD>
                  <TD>
                    {r.nextExpiryDate ? (
                      <span
                        className={
                          expired
                            ? "inline-flex items-center gap-1 text-xs text-red-700 font-semibold"
                            : expiresSoon
                              ? "inline-flex items-center gap-1 text-xs text-orange-700"
                              : "text-xs text-slate-500"
                        }
                      >
                        {(expiresSoon || expired) && <AlertTriangle className="h-3 w-3" />}
                        {formatDate(r.nextExpiryDate)}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </TD>
                  <TD className="text-xs text-slate-500">
                    {r.lastMovementAt ? formatDate(r.lastMovementAt) : "—"}
                  </TD>
                  <TD className="text-right pr-2">
                    <div className="flex items-center justify-end gap-2">
                      {isEmpty && (
                        <Badge tone="danger" className="hidden md:inline-flex">
                          <PackageX className="h-3 w-3" /> sem saldo
                        </Badge>
                      )}
                      {!isEmpty && r.belowMin && (
                        <Badge tone="warning" className="hidden md:inline-flex">
                          <TrendingDown className="h-3 w-3" /> abaixo do mínimo
                        </Badge>
                      )}
                      {expiresSoon && !expired && (
                        <Badge tone="warning" className="hidden md:inline-flex">
                          <Calendar className="h-3 w-3" /> vence em breve
                        </Badge>
                      )}
                      <Link
                        href={`/estoque/lancar?ingredientId=${r.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-roxa-700 hover:underline"
                      >
                        Lançar
                      </Link>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {rows.length} ingrediente{rows.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
