import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, History, ListTree } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { IngredientForm } from "@/components/ingredients/IngredientForm";
import {
  getIngredientById,
  getIngredientPriceHistory,
  getIngredientUsage,
} from "@/server/services/ingredient.service";
import {
  INGREDIENT_CATEGORY_LABEL,
  INGREDIENT_UNIT_LABEL,
  PRODUCT_CATEGORY_LABEL,
} from "@/lib/enums";
import { formatBRL, formatDateTime } from "@/lib/format";
import type { ProductCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function EditarIngredientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [ing, history, usage] = await Promise.all([
    getIngredientById(id),
    getIngredientPriceHistory(id),
    getIngredientUsage(id),
  ]);

  if (!ing) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/ingredientes"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para ingredientes
      </Link>

      <PageHeader
        title={ing.name}
        description={`${INGREDIENT_CATEGORY_LABEL[ing.category]} · ${INGREDIENT_UNIT_LABEL[ing.unit]} · ${formatBRL(ing.unitCost)} por ${INGREDIENT_UNIT_LABEL[ing.unit]}`}
        actions={
          ing.active ? (
            <Badge tone="success">Ativo</Badge>
          ) : (
            <Badge tone="neutral">Inativo</Badge>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form principal */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados do ingrediente</CardTitle>
            </CardHeader>
            <CardContent>
              <IngredientForm
                mode={{ type: "edit", id: ing.id }}
                defaultValues={{
                  name: ing.name,
                  category: ing.category,
                  unit: ing.unit,
                  unitCost: Number(ing.unitCost),
                  packageSize: ing.packageSize ? Number(ing.packageSize) : null,
                  packagePrice: ing.packagePrice ? Number(ing.packagePrice) : null,
                  minStock: ing.minStock ? Number(ing.minStock) : null,
                  supplier: ing.supplier,
                  brand: ing.brand,
                  notes: ing.notes,
                  active: ing.active,
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Painéis laterais */}
        <div className="space-y-6">
          {/* Histórico de preço */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-slate-500" />
                Histórico de preço
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-slate-500">Sem alterações registradas.</p>
              ) : (
                <ul className="space-y-2">
                  {history.slice(0, 10).map((h) => (
                    <li key={h.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-slate-500">{formatDateTime(h.changedAt)}</span>
                        {h.changedBy?.name && (
                          <span className="text-slate-400">{h.changedBy.name}</span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 tabular-nums">
                        <span className="text-slate-500 line-through">{formatBRL(h.oldPrice)}</span>
                        <span className="text-slate-900 font-medium">→ {formatBRL(h.newPrice)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Onde é usado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListTree className="h-4 w-4 text-slate-500" />
                Onde é usado ({usage.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usage.length === 0 ? (
                <EmptyState>Este ingrediente não está em nenhuma ficha técnica.</EmptyState>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Produto</TH>
                      <TH className="text-right">Custo total</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {usage.map((u) => (
                      <TR key={u.productId}>
                        <TD>
                          <Link
                            href={`/produtos/${u.productId}`}
                            className="font-medium text-slate-900 hover:text-roxa-700"
                          >
                            {u.productName}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {PRODUCT_CATEGORY_LABEL[u.category as ProductCategory]}
                          </p>
                        </TD>
                        <TD className="text-right tabular-nums text-slate-700">
                          {formatBRL(u.totalCost)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
