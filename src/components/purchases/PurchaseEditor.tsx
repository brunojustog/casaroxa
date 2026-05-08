"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  INGREDIENT_CATEGORY_LABEL,
  INGREDIENT_UNIT_LABEL,
} from "@/lib/enums";
import { formatBRL } from "@/lib/format";
import { savePurchaseAction } from "@/server/actions/purchases";
import type { IngredientCategory, IngredientUnit } from "@prisma/client";

export type EditorIngredient = {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: IngredientUnit;
  unitCost: number;
};

export type EditorSupplier = { id: string; name: string };

export type EditorPurchaseItem = {
  key: string;
  ingredientId: string;
  quantity: string;
  unitCost: string;
  lotNumber: string;
  expiryDate: string;
  updateIngredientCost: boolean;
};

type Mode = { type: "create" } | { type: "edit"; id: string };

let _key = 0;
const newKey = () => `tmp-${++_key}`;

export function PurchaseEditor({
  mode,
  initialSupplierId,
  initialInvoiceNumber,
  initialInvoiceDate,
  initialNotes,
  initialItems,
  ingredients,
  suppliers,
}: {
  mode: Mode;
  initialSupplierId: string;
  initialInvoiceNumber: string;
  /** ISO yyyy-mm-dd */
  initialInvoiceDate: string;
  initialNotes: string;
  initialItems: EditorPurchaseItem[];
  ingredients: EditorIngredient[];
  suppliers: EditorSupplier[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverMsg, setServerMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [supplierId, setSupplierId] = useState(initialSupplierId);
  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(initialInvoiceDate);
  const [notes, setNotes] = useState(initialNotes);
  const [items, setItems] = useState<EditorPurchaseItem[]>(initialItems);

  const [newIngredientId, setNewIngredientId] = useState(ingredients[0]?.id ?? "");
  const [newQuantity, setNewQuantity] = useState("");
  const [newUnitCost, setNewUnitCost] = useState("");

  const ingredientById = useMemo(() => {
    const m = new Map<string, EditorIngredient>();
    for (const i of ingredients) m.set(i.id, i);
    return m;
  }, [ingredients]);

  const itemRows = useMemo(
    () =>
      items.map((it) => {
        const ing = ingredientById.get(it.ingredientId);
        const qty = Number(String(it.quantity).replace(",", ".")) || 0;
        const cost = Number(String(it.unitCost).replace(",", ".")) || 0;
        return { ...it, ing, qty, cost, total: qty * cost };
      }),
    [items, ingredientById],
  );
  const total = itemRows.reduce((acc, r) => acc + r.total, 0);

  function addItem() {
    if (!newIngredientId) return;
    const qty = Number(String(newQuantity).replace(",", "."));
    const cost = Number(String(newUnitCost).replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setServerMsg({ type: "err", text: "Quantidade inválida." });
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setServerMsg({ type: "err", text: "Custo unitário inválido." });
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        ingredientId: newIngredientId,
        quantity: String(qty),
        unitCost: String(cost),
        lotNumber: "",
        expiryDate: "",
        updateIngredientCost: true,
      },
    ]);
    setNewQuantity("");
    setNewUnitCost("");
    setServerMsg(null);
  }

  function updateItem(key: string, patch: Partial<EditorPurchaseItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function fillSuggestedCost() {
    const ing = ingredientById.get(newIngredientId);
    if (ing) setNewUnitCost(String(ing.unitCost));
  }

  function save() {
    setServerMsg(null);
    const payload = {
      supplierId: supplierId || undefined,
      invoiceNumber,
      invoiceDate,
      notes,
      items: items
        .filter(
          (i) =>
            i.ingredientId &&
            Number(String(i.quantity).replace(",", ".")) > 0 &&
            Number(String(i.unitCost).replace(",", ".")) >= 0,
        )
        .map((i) => ({
          ingredientId: i.ingredientId,
          quantity: Number(String(i.quantity).replace(",", ".")),
          unitCost: Number(String(i.unitCost).replace(",", ".")),
          lotNumber: i.lotNumber,
          expiryDate: i.expiryDate || null,
          updateIngredientCost: i.updateIngredientCost,
        })),
    };
    if (payload.items.length === 0) {
      setServerMsg({ type: "err", text: "Adicione ao menos um item antes de salvar." });
      return;
    }
    startTransition(async () => {
      const res = await savePurchaseAction(
        payload,
        mode.type === "edit" ? { id: mode.id } : {},
      );
      if (!res.ok) {
        setServerMsg({ type: "err", text: res.error });
        return;
      }
      if (mode.type === "create" && res.data) {
        router.push(`/compras/${res.data.id}`);
        return;
      }
      setServerMsg({ type: "ok", text: "Compra salva." });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cabeçalho da compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Fornecedor" hint="Opcional. Cadastre em /fornecedores se ainda não existir." className="md:col-span-2">
              <Select
                value={supplierId}
                onChange={(e) => setSupplierId(e.currentTarget.value)}
              >
                <option value="">— Sem fornecedor —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data da NF / compra" required>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.currentTarget.value)}
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Número da NF (opcional)">
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.currentTarget.value)}
              />
            </Field>
          </div>
          <Field label="Observações">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens da compra</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH className="w-1/3">Ingrediente</TH>
                <TH className="text-right">Qtd.</TH>
                <TH className="text-right">Custo unit.</TH>
                <TH className="text-right">Total</TH>
                <TH>Lote</TH>
                <TH>Validade</TH>
                <TH className="text-center">Atualiza custo?</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {itemRows.map((row) => (
                <TR key={row.key}>
                  <TD>
                    <Select
                      value={row.ingredientId}
                      onChange={(e) =>
                        updateItem(row.key, { ingredientId: e.currentTarget.value })
                      }
                    >
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} — {INGREDIENT_CATEGORY_LABEL[i.category]} (
                          {INGREDIENT_UNIT_LABEL[i.unit]})
                        </option>
                      ))}
                    </Select>
                  </TD>
                  <TD className="w-24">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={row.quantity}
                      onChange={(e) =>
                        updateItem(row.key, { quantity: e.currentTarget.value })
                      }
                      className="text-right"
                    />
                  </TD>
                  <TD className="w-28">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={row.unitCost}
                      onChange={(e) =>
                        updateItem(row.key, { unitCost: e.currentTarget.value })
                      }
                      className="text-right"
                    />
                  </TD>
                  <TD className="text-right tabular-nums font-medium">
                    {formatBRL(row.total)}
                  </TD>
                  <TD className="w-24">
                    <Input
                      value={row.lotNumber}
                      onChange={(e) =>
                        updateItem(row.key, { lotNumber: e.currentTarget.value })
                      }
                    />
                  </TD>
                  <TD className="w-36">
                    <Input
                      type="date"
                      value={row.expiryDate}
                      onChange={(e) =>
                        updateItem(row.key, { expiryDate: e.currentTarget.value })
                      }
                    />
                  </TD>
                  <TD className="text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-roxa-700 focus:ring-roxa-500"
                      checked={row.updateIngredientCost}
                      onChange={(e) =>
                        updateItem(row.key, {
                          updateIngredientCost: e.currentTarget.checked,
                        })
                      }
                    />
                  </TD>
                  <TD className="w-10">
                    <button
                      type="button"
                      onClick={() => removeItem(row.key)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TD>
                </TR>
              ))}

              {items.length === 0 && (
                <TR>
                  <TD colSpan={8} className="text-center text-sm text-slate-500 py-6">
                    Nenhum item adicionado ainda.
                  </TD>
                </TR>
              )}

              {/* Linha adicionar */}
              <TR className="bg-slate-50">
                <TD>
                  <Select
                    value={newIngredientId}
                    onChange={(e) => {
                      setNewIngredientId(e.currentTarget.value);
                      setNewUnitCost("");
                    }}
                  >
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} — {INGREDIENT_CATEGORY_LABEL[i.category]} (
                        {INGREDIENT_UNIT_LABEL[i.unit]})
                      </option>
                    ))}
                  </Select>
                </TD>
                <TD className="w-24">
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={newQuantity}
                    placeholder="Qtd"
                    onChange={(e) => setNewQuantity(e.currentTarget.value)}
                    className="text-right"
                  />
                </TD>
                <TD className="w-28">
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={newUnitCost}
                      placeholder={String(
                        ingredientById.get(newIngredientId)?.unitCost ?? "",
                      )}
                      onChange={(e) => setNewUnitCost(e.currentTarget.value)}
                      className="text-right"
                    />
                  </div>
                </TD>
                <TD className="text-right text-slate-300">—</TD>
                <TD colSpan={2} className="text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={fillSuggestedCost}
                    className="text-roxa-700 hover:underline"
                  >
                    usar custo cadastrado ({formatBRL(ingredientById.get(newIngredientId)?.unitCost ?? 0)})
                  </button>
                </TD>
                <TD />
                <TD>
                  <Button type="button" size="sm" variant="outline" onClick={addItem}>
                    <Plus className="h-3 w-3" />
                    Adicionar
                  </Button>
                </TD>
              </TR>

              <TR className="font-semibold">
                <TD colSpan={3} className="text-right">
                  Total da compra
                </TD>
                <TD className="text-right tabular-nums">{formatBRL(total)}</TD>
                <TD colSpan={4} />
              </TR>
            </TBody>
          </Table>

          <p className="text-xs text-slate-500 mt-3">
            <strong>Atualiza custo?</strong> Marcado: ao confirmar a compra, o custo
            unitário do ingrediente é atualizado para o desta compra. Isso dispara a
            cascata: ficha técnica → produto → combo recalculam automaticamente.
          </p>
        </CardContent>
      </Card>

      {serverMsg && (
        <div
          className={
            serverMsg.type === "ok"
              ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {serverMsg.text}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/compras"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="button" onClick={save} disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Salvando…" : mode.type === "create" ? "Salvar como rascunho" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
