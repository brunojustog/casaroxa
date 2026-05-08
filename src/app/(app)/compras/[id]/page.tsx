import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  PurchaseEditor,
  type EditorIngredient,
  type EditorPurchaseItem,
  type EditorSupplier,
} from "@/components/purchases/PurchaseEditor";
import { PurchaseStatusActions } from "@/components/purchases/PurchaseStatusActions";
import {
  PURCHASE_STATUS_LABEL,
  PURCHASE_STATUS_TONE,
  getPurchaseById,
} from "@/server/services/purchase.service";
import { listActiveSuppliers } from "@/server/services/supplier.service";
import { getActiveIngredientsForStock } from "@/server/services/stock.service";
import {
  INGREDIENT_CATEGORY_LABEL,
  INGREDIENT_UNIT_LABEL,
} from "@/lib/enums";
import { formatBRL, formatDate, formatDateTime, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CompraDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [purchase, ingredients, suppliers] = await Promise.all([
    getPurchaseById(id),
    getActiveIngredientsForStock(),
    listActiveSuppliers(),
  ]);

  if (!purchase) notFound();

  const isDraft = purchase.status === "RASCUNHO";

  const editorIngredients: EditorIngredient[] = ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    unit: i.unit,
    unitCost: Number(i.unitCost),
  }));
  const editorSuppliers: EditorSupplier[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  const initialItems: EditorPurchaseItem[] = purchase.items.map((it) => ({
    key: it.id,
    ingredientId: it.ingredientId,
    quantity: String(Number(it.quantity)),
    unitCost: String(Number(it.unitCost)),
    lotNumber: it.lotNumber ?? "",
    expiryDate: it.expiryDate ? it.expiryDate.toISOString().slice(0, 10) : "",
    updateIngredientCost: it.updateIngredientCost,
  }));

  const invoiceDateIso = purchase.invoiceDate.toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <Link
        href="/compras"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para compras
      </Link>

      <PageHeader
        title={`Compra ${purchase.invoiceNumber ?? `#${purchase.id.slice(0, 8)}`}`}
        description={[
          purchase.supplier?.name ?? "Sem fornecedor",
          formatDate(purchase.invoiceDate),
          formatBRL(purchase.totalAmount),
        ].join(" · ")}
        actions={
          <Badge tone={PURCHASE_STATUS_TONE[purchase.status]}>
            {PURCHASE_STATUS_LABEL[purchase.status]}
          </Badge>
        }
      />

      <PurchaseStatusActions id={purchase.id} status={purchase.status} />

      {isDraft ? (
        <PurchaseEditor
          mode={{ type: "edit", id: purchase.id }}
          initialSupplierId={purchase.supplierId ?? ""}
          initialInvoiceNumber={purchase.invoiceNumber ?? ""}
          initialInvoiceDate={invoiceDateIso}
          initialNotes={purchase.notes ?? ""}
          initialItems={initialItems}
          ingredients={editorIngredients}
          suppliers={editorSuppliers}
        />
      ) : (
        // Visualização (não editável) para CONFIRMADA / CANCELADA
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-slate-500" />
                Itens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>Ingrediente</TH>
                    <TH className="text-right">Qtd.</TH>
                    <TH className="text-right">Custo unit.</TH>
                    <TH className="text-right">Total</TH>
                    <TH>Lote</TH>
                    <TH>Validade</TH>
                    <TH className="text-center">Atualizou custo?</TH>
                  </TR>
                </THead>
                <TBody>
                  {purchase.items.map((it) => (
                    <TR key={it.id}>
                      <TD className="font-medium">
                        <Link
                          href={`/ingredientes/${it.ingredientId}`}
                          className="hover:text-roxa-700"
                        >
                          {it.ingredient.name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {INGREDIENT_CATEGORY_LABEL[it.ingredient.category]}
                        </p>
                      </TD>
                      <TD className="text-right tabular-nums">
                        {formatNumber(it.quantity)}{" "}
                        <span className="text-xs text-slate-400">
                          {INGREDIENT_UNIT_LABEL[it.ingredient.unit]}
                        </span>
                      </TD>
                      <TD className="text-right tabular-nums text-slate-600">
                        {formatBRL(it.unitCost)}
                      </TD>
                      <TD className="text-right tabular-nums font-medium">
                        {formatBRL(it.totalCost)}
                      </TD>
                      <TD className="text-xs text-slate-600">
                        {it.lotNumber ?? "—"}
                      </TD>
                      <TD className="text-xs text-slate-600">
                        {it.expiryDate ? formatDate(it.expiryDate) : "—"}
                      </TD>
                      <TD className="text-center text-xs">
                        {it.updateIngredientCost ? "✓" : "—"}
                      </TD>
                    </TR>
                  ))}
                  <TR className="font-semibold">
                    <TD colSpan={3} className="text-right">
                      Total
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatBRL(purchase.totalAmount)}
                    </TD>
                    <TD colSpan={3} />
                  </TR>
                </TBody>
              </Table>
            </CardContent>
          </Card>

          {purchase.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {purchase.notes}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Auditoria</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>
                  Criada em <strong>{formatDateTime(purchase.createdAt)}</strong>
                  {purchase.user?.name && ` por ${purchase.user.name}`}
                </li>
                {purchase.confirmedAt && (
                  <li>
                    Confirmada em <strong>{formatDateTime(purchase.confirmedAt)}</strong>
                  </li>
                )}
                {purchase.cancelledAt && (
                  <li>
                    Cancelada em <strong>{formatDateTime(purchase.cancelledAt)}</strong>
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
