import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, History, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ProductForm } from "@/components/products/ProductForm";
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";
import {
  getProductById,
  getProductPriceHistory,
} from "@/server/services/product.service";
import {
  PRODUCT_CATEGORY_LABEL,
  PRODUCT_STATUS_LABEL,
  PRODUCT_TYPE_LABEL,
  INGREDIENT_UNIT_LABEL,
} from "@/lib/enums";
import { formatBRL, formatDateTime, formatPercent, formatNumber } from "@/lib/format";
import { calculateCmv, calculateGrossProfit } from "@/domain/calculations";

export const dynamic = "force-dynamic";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, priceHistory] = await Promise.all([
    getProductById(id),
    getProductPriceHistory(id),
  ]);

  if (!product) notFound();

  const cost = Number(product.totalCost);
  const price = product.salePrice ? Number(product.salePrice) : 0;
  const targetCmv = product.targetCmv ? Number(product.targetCmv) : 0.5;
  const cmv = price > 0 ? calculateCmv(cost, price) : null;
  const profit = price > 0 ? calculateGrossProfit(cost, price) : null;

  return (
    <div className="space-y-5">
      <Link
        href="/produtos"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para produtos
      </Link>

      <PageHeader
        title={product.name}
        description={[
          PRODUCT_CATEGORY_LABEL[product.category],
          PRODUCT_TYPE_LABEL[product.type],
          product.portionLabel,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            {product.status !== "ATIVO" && (
              <Badge tone="warning">{PRODUCT_STATUS_LABEL[product.status]}</Badge>
            )}
            {product.active ? (
              <ProductStatusBadge cost={cost} price={price} targetCmv={targetCmv} />
            ) : (
              <Badge tone="neutral">Inativo</Badge>
            )}
          </div>
        }
      />

      {/* Resumo financeiro */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Custo total" value={formatBRL(cost)} />
        <SummaryCard
          label="Preço de venda"
          value={price > 0 ? formatBRL(price) : "—"}
        />
        <SummaryCard
          label="CMV"
          value={cmv ? formatPercent(cmv) : "—"}
          accent={
            cmv && Number(cmv) > targetCmv ? "warning" : cmv ? "ok" : "neutral"
          }
          hint={`meta ${formatPercent(targetCmv)}`}
        />
        <SummaryCard
          label="Lucro bruto"
          value={profit ? formatBRL(profit) : "—"}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form principal */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados do produto</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductForm
                mode={{ type: "edit", id: product.id }}
                defaultValues={{
                  name: product.name,
                  category: product.category,
                  type: product.type,
                  portionLabel: product.portionLabel,
                  salePrice: product.salePrice ? Number(product.salePrice) : null,
                  targetCmv: product.targetCmv ? Number(product.targetCmv) : null,
                  description: product.description,
                  notes: product.notes,
                  status: product.status,
                  active: product.active,
                  imageUrl: product.imageUrl,
                  showInMenu: product.showInMenu,
                  ingredientsPublic: product.ingredientsPublic,
                  gallery: Array.isArray(product.gallery)
                    ? (product.gallery as string[])
                    : null,
                  youtubeUrl: product.youtubeUrl,
                  scaleCode: product.scaleCode,
                  scaleName: product.scaleName,
                  scaleValidityDays: product.scaleValidityDays,
                  barcode: product.barcode,
                }}
              />
            </CardContent>
          </Card>

          {/* Ficha técnica resumida */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-slate-500" />
                Ficha técnica
              </CardTitle>
              <Link
                href={`/fichas-tecnicas/${product.id}`}
                className="text-xs font-medium text-roxa-700 hover:underline"
              >
                {product.recipe ? "Editar ficha" : "Criar ficha (Fase 4)"}
              </Link>
            </CardHeader>
            <CardContent>
              {!product.recipe || product.recipe.items.length === 0 ? (
                <EmptyState>
                  Este produto ainda não tem ficha técnica.
                </EmptyState>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Ingrediente</TH>
                      <TH className="text-right">Quantidade</TH>
                      <TH className="text-right">Custo unit.</TH>
                      <TH className="text-right">Total</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {product.recipe.items.map((it) => (
                      <TR key={it.id}>
                        <TD className="font-medium text-slate-900">
                          <Link
                            href={`/ingredientes/${it.ingredientId}`}
                            className="hover:text-roxa-700"
                          >
                            {it.ingredient.name}
                          </Link>
                        </TD>
                        <TD className="text-right tabular-nums">
                          {formatNumber(it.quantity)} {INGREDIENT_UNIT_LABEL[it.unit]}
                        </TD>
                        <TD className="text-right tabular-nums text-slate-500">
                          {formatBRL(it.unitCostSnapshot)}
                        </TD>
                        <TD className="text-right tabular-nums">
                          {formatBRL(it.totalCost)}
                        </TD>
                      </TR>
                    ))}
                    <TR className="bg-slate-50 font-semibold">
                      <TD colSpan={3} className="text-right">
                        Custo total
                      </TD>
                      <TD className="text-right tabular-nums">
                        {formatBRL(product.recipe.totalCost)}
                      </TD>
                    </TR>
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Painel lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-slate-500" />
                Histórico de preço de venda
              </CardTitle>
            </CardHeader>
            <CardContent>
              {priceHistory.length === 0 ? (
                <p className="text-xs text-slate-500">Sem alterações registradas.</p>
              ) : (
                <ul className="space-y-2">
                  {priceHistory.slice(0, 10).map((h) => (
                    <li
                      key={h.id}
                      className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div className="text-slate-500">{formatDateTime(h.changedAt)}</div>
                      <div className="mt-1 flex items-center justify-between gap-2 tabular-nums">
                        <span className="text-slate-500 line-through">
                          {h.oldPrice ? formatBRL(h.oldPrice) : "sem preço"}
                        </span>
                        <span className="text-slate-900 font-medium">
                          → {h.newPrice ? formatBRL(h.newPrice) : "sem preço"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Onde aparece</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Combos que usam este produto</span>
                  <span className="font-semibold tabular-nums">
                    {product._count.comboItems}
                  </span>
                </div>
                {product._count.comboItems > 0 && (
                  <p className="text-slate-400 mt-2">
                    Mudanças no custo deste produto recalculam todos esses combos
                    automaticamente.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  accent = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "ok" | "warning" | "neutral";
}) {
  const valueColor =
    accent === "warning"
      ? "text-orange-700"
      : accent === "ok"
        ? "text-green-700"
        : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
