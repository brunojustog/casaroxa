"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";
import {
  INGREDIENT_CATEGORY_LABEL,
  INGREDIENT_UNIT_LABEL,
} from "@/lib/enums";
import { formatBRL, formatNumber, formatPercent } from "@/lib/format";
import { calculateCmv, calculateGrossProfit } from "@/domain/calculations";
import {
  saveRecipeAction,
  saveRecipeVersionAction,
} from "@/server/actions/recipes";
import type { IngredientCategory, IngredientUnit } from "@prisma/client";

export type EditorIngredient = {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: IngredientUnit;
  unitCost: number;
};

export type EditorItem = {
  /** ID temporário do client; a chave estável (não vai pro server). */
  key: string;
  ingredientId: string;
  quantity: string; // mantém string para input, converte na hora
  notes: string;
};

export type RecipeEditorProps = {
  productId: string;
  productName: string;
  productSalePrice: number | null;
  productTargetCmv: number | null;
  initialItems: EditorItem[];
  initialResponsible: string;
  initialRecipeNotes: string;
  ingredients: EditorIngredient[];
  recipeExists: boolean;
};

let _key = 0;
const newKey = () => `tmp-${++_key}`;

export function RecipeEditor({
  productId,
  productName,
  productSalePrice,
  productTargetCmv,
  initialItems,
  initialResponsible,
  initialRecipeNotes,
  ingredients,
}: RecipeEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverMsg, setServerMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [responsible, setResponsible] = useState(initialResponsible);
  const [notes, setNotes] = useState(initialRecipeNotes);
  const [items, setItems] = useState<EditorItem[]>(initialItems);

  // estado da linha "adicionar"
  const [newIngredientId, setNewIngredientId] = useState<string>(ingredients[0]?.id ?? "");
  const [newQuantity, setNewQuantity] = useState<string>("");

  const ingredientById = useMemo(() => {
    const m = new Map<string, EditorIngredient>();
    for (const i of ingredients) m.set(i.id, i);
    return m;
  }, [ingredients]);

  // ---------- cálculos em tempo real ----------
  const itemRows = useMemo(
    () =>
      items.map((it) => {
        const ing = ingredientById.get(it.ingredientId);
        const qty = Number(String(it.quantity).replace(",", ".")) || 0;
        const unitCost = ing ? Number(ing.unitCost) : 0;
        const total = qty * unitCost;
        return { ...it, ing, qty, unitCost, total };
      }),
    [items, ingredientById],
  );
  const recipeTotal = itemRows.reduce((acc, r) => acc + r.total, 0);

  const price = productSalePrice ?? 0;
  const target = productTargetCmv ?? 0.5;
  const cmv = price > 0 ? Number(calculateCmv(recipeTotal, price)) : null;
  const profit = price > 0 ? Number(calculateGrossProfit(recipeTotal, price)) : null;

  // ---------- handlers ----------
  function addItem() {
    if (!newIngredientId) return;
    const qty = Number(String(newQuantity).replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setServerMsg({ type: "err", text: "Quantidade inválida." });
      return;
    }
    setItems((prev) => [
      ...prev,
      { key: newKey(), ingredientId: newIngredientId, quantity: String(qty), notes: "" },
    ]);
    setNewQuantity("");
    setServerMsg(null);
  }

  function updateItem(key: string, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function save() {
    setServerMsg(null);
    const payload = {
      productId,
      responsible,
      notes,
      items: items
        .filter((i) => i.ingredientId && Number(String(i.quantity).replace(",", ".")) > 0)
        .map((i) => ({
          ingredientId: i.ingredientId,
          quantity: Number(String(i.quantity).replace(",", ".")),
          notes: i.notes,
        })),
    };
    startTransition(async () => {
      const res = await saveRecipeAction(payload);
      if (!res.ok) {
        setServerMsg({ type: "err", text: res.error });
      } else {
        setServerMsg({ type: "ok", text: "Ficha salva. Combos recalculados." });
        router.refresh();
      }
    });
  }

  function saveVersion() {
    const noteInput = window.prompt("Nota desta versão (opcional):", "");
    if (noteInput === null) return; // cancelado
    startTransition(async () => {
      const res = await saveRecipeVersionAction(productId, { notes: noteInput });
      if (!res.ok) setServerMsg({ type: "err", text: res.error });
      else {
        setServerMsg({
          type: "ok",
          text: `Versão ${res.data?.version ?? ""} salva.`,
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Resumo financeiro em tempo real */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Custo da ficha" value={formatBRL(recipeTotal)} />
        <SummaryCard label="Preço de venda" value={price > 0 ? formatBRL(price) : "—"} />
        <SummaryCard
          label="CMV"
          value={cmv !== null ? formatPercent(cmv) : "—"}
          accent={cmv !== null && cmv > target ? "warning" : cmv !== null ? "ok" : "neutral"}
          hint={`meta ${formatPercent(target)}`}
        />
        <SummaryCard label="Lucro bruto" value={profit !== null ? formatBRL(profit) : "—"} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <ProductStatusBadge cost={recipeTotal} price={price} targetCmv={target} />
        <span className="text-xs text-slate-500">
          Cálculo é em tempo real conforme você edita; clique em <strong>Salvar</strong> para
          persistir.
        </span>
      </div>

      {/* Tabela editável */}
      <Card>
        <CardHeader>
          <CardTitle>Ingredientes da ficha técnica</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH className="w-2/5">Ingrediente</TH>
                <TH className="text-right">Quantidade</TH>
                <TH>Unidade</TH>
                <TH className="text-right">Custo unit.</TH>
                <TH className="text-right">Custo total</TH>
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
                          {i.name} — {INGREDIENT_CATEGORY_LABEL[i.category]}
                        </option>
                      ))}
                    </Select>
                  </TD>
                  <TD className="w-32">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={row.quantity}
                      onChange={(e) => updateItem(row.key, { quantity: e.currentTarget.value })}
                      className="text-right"
                    />
                  </TD>
                  <TD className="text-slate-500">
                    {row.ing ? INGREDIENT_UNIT_LABEL[row.ing.unit] : "—"}
                  </TD>
                  <TD className="text-right tabular-nums text-slate-500">
                    {formatBRL(row.unitCost)}
                  </TD>
                  <TD className="text-right tabular-nums font-medium">
                    {formatBRL(row.total)}
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
                  <TD colSpan={6} className="text-center text-sm text-slate-500 py-6">
                    Esta ficha ainda não tem ingredientes.
                  </TD>
                </TR>
              )}

              {/* Linha "adicionar" */}
              <TR className="bg-slate-50">
                <TD>
                  <Select
                    value={newIngredientId}
                    onChange={(e) => setNewIngredientId(e.currentTarget.value)}
                  >
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} — {INGREDIENT_CATEGORY_LABEL[i.category]}
                      </option>
                    ))}
                  </Select>
                </TD>
                <TD className="w-32">
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="Qtd"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addItem();
                      }
                    }}
                    className="text-right"
                  />
                </TD>
                <TD className="text-slate-500">
                  {INGREDIENT_UNIT_LABEL[
                    ingredientById.get(newIngredientId)?.unit ?? "UNIDADE"
                  ]}
                </TD>
                <TD className="text-right tabular-nums text-slate-500">
                  {formatBRL(ingredientById.get(newIngredientId)?.unitCost ?? 0)}
                </TD>
                <TD className="text-right text-slate-300">—</TD>
                <TD>
                  <Button type="button" size="sm" variant="outline" onClick={addItem}>
                    <Plus className="h-3 w-3" />
                    Adicionar
                  </Button>
                </TD>
              </TR>

              <TR className="font-semibold">
                <TD colSpan={4} className="text-right">
                  Custo total
                </TD>
                <TD className="text-right tabular-nums">{formatBRL(recipeTotal)}</TD>
                <TD />
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Meta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Anotações</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Responsável" htmlFor="responsible">
            <Input
              id="responsible"
              value={responsible}
              onChange={(e) => setResponsible(e.currentTarget.value)}
              placeholder="Nome do operador"
            />
          </Field>
          <Field label="Notas da ficha" htmlFor="recipe-notes">
            <Textarea
              id="recipe-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </Field>
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

      {/* Ações principais */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={saveVersion} disabled={isPending}>
          <GitBranch className="h-4 w-4" />
          Salvar versão
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 mr-2">{productName}</span>
          <Button type="button" onClick={save} disabled={isPending}>
            <Save className="h-4 w-4" />
            {isPending ? "Salvando…" : "Salvar ficha"}
          </Button>
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
