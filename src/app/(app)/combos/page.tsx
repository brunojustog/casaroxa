import Link from "next/link";
import { Plus } from "lucide-react";
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
import { ComboFilters } from "@/components/combos/ComboFilters";
import { ComboRowActions } from "@/components/combos/ComboRowActions";
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";
import { listCombos } from "@/server/services/combo.service";
import { comboListFiltersSchema } from "@/schemas/combo.schema";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/enums";
import { formatBRL, formatPercent } from "@/lib/format";
import { calculateCmv, calculateGrossProfit } from "@/domain/calculations";

export const dynamic = "force-dynamic";

export default async function CombosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = comboListFiltersSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    category:
      typeof params.category === "string" && params.category.length > 0
        ? params.category
        : undefined,
    active: typeof params.active === "string" ? params.active : "active",
  });

  const combos = await listCombos(filters);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Combos"
        description="Cada combo agrupa produtos em uma oferta. Custo recalcula automaticamente quando produtos mudam."
        actions={
          <Link
            href="/combos/novo"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Novo combo
          </Link>
        }
      />

      <ComboFilters />

      {combos.length === 0 ? (
        <EmptyState>
          Nenhum combo encontrado com esses filtros.{" "}
          <Link href="/combos/novo" className="text-roxa-700 hover:underline">
            Criar o primeiro
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Combo</TH>
              <TH>Categoria</TH>
              <TH className="text-center">Itens</TH>
              <TH className="text-right">Custo</TH>
              <TH className="text-right">Preço</TH>
              <TH className="text-right">CMV</TH>
              <TH className="text-right">Lucro bruto</TH>
              <TH>Status</TH>
              <TH className="text-right pr-4">Ações</TH>
            </TR>
          </THead>
          <TBody>
            {combos.map((c) => {
              const cost = Number(c.totalCost);
              const price = c.salePrice ? Number(c.salePrice) : 0;
              const targetCmv = c.targetCmv ? Number(c.targetCmv) : 0.45;
              const cmv = price > 0 ? calculateCmv(cost, price) : null;
              const profit = price > 0 ? calculateGrossProfit(cost, price) : null;

              return (
                <TR key={c.id}>
                  <TD className="font-medium text-slate-900">
                    <Link href={`/combos/${c.id}`} className="hover:text-roxa-700">
                      {c.name}
                    </Link>
                    {!c.active && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">
                        inativo
                      </span>
                    )}
                  </TD>
                  <TD>{PRODUCT_CATEGORY_LABEL[c.category]}</TD>
                  <TD className="text-center text-slate-700 tabular-nums">
                    {c._count.items}
                  </TD>
                  <TD className="text-right tabular-nums">{formatBRL(cost)}</TD>
                  <TD className="text-right tabular-nums">
                    {price > 0 ? formatBRL(price) : <span className="text-slate-400">—</span>}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {cmv ? (
                      <span className={Number(cmv) > targetCmv ? "text-orange-700" : "text-slate-700"}>
                        {formatPercent(cmv)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {profit ? formatBRL(profit) : <span className="text-slate-400">—</span>}
                  </TD>
                  <TD>
                    {c.active ? (
                      <ProductStatusBadge cost={cost} price={price} targetCmv={targetCmv} />
                    ) : (
                      <Badge tone="neutral">Inativo</Badge>
                    )}
                  </TD>
                  <TD className="text-right pr-2">
                    <ComboRowActions id={c.id} active={c.active} />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {combos.length} combo{combos.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
