import Link from "next/link";
import { Plus, AlertCircle, Scale } from "lucide-react";
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
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductRowActions } from "@/components/products/ProductRowActions";
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";
import { listProducts } from "@/server/services/product.service";
import { productListFiltersSchema } from "@/schemas/product.schema";
import {
  PRODUCT_CATEGORY_LABEL,
  PRODUCT_STATUS_LABEL,
} from "@/lib/enums";
import { formatBRL, formatPercent } from "@/lib/format";
import { calculateCmv, calculateGrossProfit } from "@/domain/calculations";

export const dynamic = "force-dynamic";

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = productListFiltersSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    category:
      typeof params.category === "string" && params.category.length > 0
        ? params.category
        : undefined,
    status:
      typeof params.status === "string" && params.status.length > 0
        ? params.status
        : undefined,
    active: typeof params.active === "string" ? params.active : "active",
  });

  const products = await listProducts(filters);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Produtos"
        description="Cada produto vendido tem custo (vindo da ficha técnica), preço de venda e CMV calculado em tempo real."
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/api/export/balanca"
              download
              title="Baixa o ITENSMGV.TXT com os produtos que têm código de balança — importe no MGV e envie pra balança."
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-roxa-200 bg-white px-4 text-sm font-medium text-roxa-800 hover:bg-roxa-50"
            >
              <Scale className="h-4 w-4" />
              Carga da balança
            </a>
            <Link
              href="/produtos/novo"
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
            >
              <Plus className="h-4 w-4" />
              Novo produto
            </Link>
          </div>
        }
      />

      <ProductFilters />

      {products.length === 0 ? (
        <EmptyState>
          Nenhum produto encontrado com esses filtros.{" "}
          <Link href="/produtos/novo" className="text-roxa-700 hover:underline">
            Cadastrar o primeiro
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Produto</TH>
              <TH>Categoria</TH>
              <TH className="text-right">Custo</TH>
              <TH className="text-right">Preço</TH>
              <TH className="text-right">CMV</TH>
              <TH className="text-right">Lucro bruto</TH>
              <TH>Status</TH>
              <TH className="text-right pr-4">Ações</TH>
            </TR>
          </THead>
          <TBody>
            {products.map((p) => {
              const cost = Number(p.totalCost);
              const price = p.salePrice ? Number(p.salePrice) : 0;
              const targetCmv = p.targetCmv ? Number(p.targetCmv) : 0.5;
              const cmv = price > 0 ? calculateCmv(cost, price) : null;
              const profit = price > 0 ? calculateGrossProfit(cost, price) : null;
              const noRecipe = !p.recipe;

              return (
                <TR key={p.id}>
                  <TD className="font-medium text-slate-900">
                    <Link href={`/produtos/${p.id}`} className="hover:text-roxa-700">
                      {p.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.scaleCode && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded bg-roxa-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-roxa-800"
                          title={`Código na balança: ${p.scaleCode}`}
                        >
                          <Scale className="h-3 w-3" />
                          {parseInt(p.scaleCode, 10)}
                        </span>
                      )}
                      {p.portionLabel && (
                        <span className="text-xs text-slate-500">
                          {p.portionLabel}
                        </span>
                      )}
                      {p.status !== "ATIVO" && (
                        <span className="text-[10px] uppercase tracking-wide text-amber-700">
                          {PRODUCT_STATUS_LABEL[p.status]}
                        </span>
                      )}
                      {!p.active && (
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">
                          inativo
                        </span>
                      )}
                      {noRecipe && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] text-red-600"
                          title="Produto sem ficha técnica"
                        >
                          <AlertCircle className="h-3 w-3" />
                          sem ficha
                        </span>
                      )}
                      {p.recipe && !p.recipe.reviewed && (
                        <span className="text-[10px] text-yellow-700" title="Ficha técnica não revisada">
                          ficha não revisada
                        </span>
                      )}
                    </div>
                  </TD>
                  <TD>{PRODUCT_CATEGORY_LABEL[p.category]}</TD>
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
                    {p.active ? (
                      <ProductStatusBadge cost={cost} price={price} targetCmv={targetCmv} />
                    ) : (
                      <Badge tone="neutral">Inativo</Badge>
                    )}
                  </TD>
                  <TD className="text-right pr-2">
                    <ProductRowActions
                      id={p.id}
                      active={p.active}
                      showInMenu={p.showInMenu}
                    />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {products.length} produto{products.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
