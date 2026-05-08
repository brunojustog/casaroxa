"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";
import {
  enumOptions,
  PRODUCT_CATEGORY_LABEL,
} from "@/lib/enums";
import { formatBRL, formatPercent } from "@/lib/format";
import { calculateCmv, calculateGrossProfit } from "@/domain/calculations";
import { saveComboAction } from "@/server/actions/combos";
import type { ProductCategory } from "@prisma/client";

const CATEGORIES = enumOptions(PRODUCT_CATEGORY_LABEL);

export type EditorProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  portionLabel: string | null;
  totalCost: number;
  salePrice: number | null;
};

export type EditorComboItem = {
  key: string;
  productId: string;
  quantity: string;
};

type Mode = { type: "create" } | { type: "edit"; id: string };

let _key = 0;
const newKey = () => `tmp-${++_key}`;

export function ComboEditor({
  mode,
  initialName,
  initialCategory,
  initialDescription,
  initialSalePrice,
  initialTargetCmvPercent,
  initialNotes,
  initialActive,
  initialImageUrl,
  initialShowInMenu,
  initialItems,
  products,
}: {
  mode: Mode;
  initialName: string;
  initialCategory: ProductCategory;
  initialDescription: string;
  initialSalePrice: string;
  /** Em percent (0-100). */
  initialTargetCmvPercent: string;
  initialNotes: string;
  initialActive: boolean;
  initialImageUrl: string;
  initialShowInMenu: boolean;
  initialItems: EditorComboItem[];
  products: EditorProduct[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverMsg, setServerMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // meta
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<ProductCategory>(initialCategory);
  const [description, setDescription] = useState(initialDescription);
  const [salePrice, setSalePrice] = useState(initialSalePrice);
  const [targetCmvPercent, setTargetCmvPercent] = useState(initialTargetCmvPercent);
  const [notes, setNotes] = useState(initialNotes);
  const [active, setActive] = useState(initialActive);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [showInMenu, setShowInMenu] = useState(initialShowInMenu);

  // items
  const [items, setItems] = useState<EditorComboItem[]>(initialItems);

  // adicionar
  const [newProductId, setNewProductId] = useState<string>(products[0]?.id ?? "");
  const [newQuantity, setNewQuantity] = useState<string>("1");

  const productById = useMemo(() => {
    const m = new Map<string, EditorProduct>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  // ---------- cálculos ----------
  const itemRows = useMemo(
    () =>
      items.map((it) => {
        const prod = productById.get(it.productId);
        const qty = Number(String(it.quantity).replace(",", ".")) || 0;
        const unitCost = prod ? Number(prod.totalCost) : 0;
        const total = qty * unitCost;
        return { ...it, prod, qty, unitCost, total };
      }),
    [items, productById],
  );
  const comboTotal = itemRows.reduce((acc, r) => acc + r.total, 0);

  const priceNum = Number(String(salePrice).replace(",", ".")) || 0;
  const targetFraction = Number(targetCmvPercent) > 0 ? Number(targetCmvPercent) / 100 : 0.45;
  const cmv = priceNum > 0 ? Number(calculateCmv(comboTotal, priceNum)) : null;
  const profit = priceNum > 0 ? Number(calculateGrossProfit(comboTotal, priceNum)) : null;

  // ---------- handlers ----------
  function addItem() {
    if (!newProductId) return;
    const qty = Number(String(newQuantity).replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setServerMsg({ type: "err", text: "Quantidade inválida." });
      return;
    }
    setItems((prev) => [
      ...prev,
      { key: newKey(), productId: newProductId, quantity: String(qty) },
    ]);
    setNewQuantity("1");
    setServerMsg(null);
  }

  function updateItem(key: string, patch: Partial<EditorComboItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function save() {
    setServerMsg(null);
    const payload = {
      name,
      category,
      description,
      salePrice,
      targetCmv: targetCmvPercent,
      notes,
      active,
      imageUrl,
      showInMenu,
      items: items
        .filter((i) => i.productId && Number(String(i.quantity).replace(",", ".")) > 0)
        .map((i) => ({
          productId: i.productId,
          quantity: Number(String(i.quantity).replace(",", ".")),
        })),
    };
    startTransition(async () => {
      const res = await saveComboAction(payload, mode.type === "edit" ? { id: mode.id } : {});
      if (!res.ok) {
        setServerMsg({ type: "err", text: res.error });
        return;
      }
      if (mode.type === "create" && res.data) {
        router.push(`/combos/${res.data.id}`);
        return;
      }
      setServerMsg({ type: "ok", text: "Combo salvo." });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Resumo financeiro em tempo real */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Custo do combo" value={formatBRL(comboTotal)} />
        <SummaryCard label="Preço de venda" value={priceNum > 0 ? formatBRL(priceNum) : "—"} />
        <SummaryCard
          label="CMV"
          value={cmv !== null ? formatPercent(cmv) : "—"}
          accent={cmv !== null && cmv > targetFraction ? "warning" : cmv !== null ? "ok" : "neutral"}
          hint={`meta ${formatPercent(targetFraction)}`}
        />
        <SummaryCard label="Lucro bruto" value={profit !== null ? formatBRL(profit) : "—"} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <ProductStatusBadge cost={comboTotal} price={priceNum} targetCmv={targetFraction} />
        <span className="text-xs text-slate-500">
          Cálculo é em tempo real conforme você edita; clique em <strong>Salvar combo</strong>{" "}
          para persistir.
        </span>
      </div>

      {/* Meta */}
      <Card>
        <CardHeader>
          <CardTitle>Dados do combo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Nome do combo" htmlFor="name" required className="md:col-span-2">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                placeholder="Ex.: Combo Frango Família"
              />
            </Field>
            <Field label="Categoria" htmlFor="category" required>
              <Select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.currentTarget.value as ProductCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Preço de venda (R$)" htmlFor="salePrice">
              <Input
                id="salePrice"
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.currentTarget.value)}
              />
            </Field>
            <Field label="Meta de CMV (%)" htmlFor="targetCmv" hint="0–100. Ex.: 45 para 45%.">
              <Input
                id="targetCmv"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={targetCmvPercent}
                onChange={(e) => setTargetCmvPercent(e.currentTarget.value)}
              />
            </Field>
          </div>

          <Field
            label="Descrição comercial (opcional)"
            htmlFor="description"
            hint="Aparece no cardápio online."
          >
            <Textarea
              id="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
          </Field>

          <Field
            label="Observações internas (opcional)"
            htmlFor="notes"
            hint="Apenas você vê. Não aparece no cardápio."
          >
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </Field>

          <div className="flex items-center gap-2">
            <Checkbox
              id="active"
              checked={active}
              onChange={(e) => setActive(e.currentTarget.checked)}
            />
            <label htmlFor="active" className="text-sm text-slate-700">
              Combo ativo
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Cardápio online</h3>
            <Field label="URL da foto" htmlFor="imageUrl" hint="Ex.: /menu/combo.jpg ou URL completa.">
              <Input
                id="imageUrl"
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.currentTarget.value)}
                placeholder="/menu/combo.jpg"
              />
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showInMenu"
                checked={showInMenu}
                onChange={(e) => setShowInMenu(e.currentTarget.checked)}
              />
              <label htmlFor="showInMenu" className="text-sm text-slate-700">
                Mostrar no cardápio online (apenas se ativo e com preço)
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itens */}
      <Card>
        <CardHeader>
          <CardTitle>Itens do combo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH className="w-2/5">Produto</TH>
                <TH className="text-right">Quantidade</TH>
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
                      value={row.productId}
                      onChange={(e) =>
                        updateItem(row.key, { productId: e.currentTarget.value })
                      }
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.portionLabel ? ` — ${p.portionLabel}` : ""}
                        </option>
                      ))}
                    </Select>
                  </TD>
                  <TD className="w-32">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.quantity}
                      onChange={(e) =>
                        updateItem(row.key, { quantity: e.currentTarget.value })
                      }
                      className="text-right"
                    />
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
                  <TD colSpan={5} className="text-center text-sm text-slate-500 py-6">
                    Este combo ainda não tem itens.
                  </TD>
                </TR>
              )}

              {/* Linha adicionar */}
              <TR className="bg-slate-50">
                <TD>
                  <Select
                    value={newProductId}
                    onChange={(e) => setNewProductId(e.currentTarget.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.portionLabel ? ` — ${p.portionLabel}` : ""}
                      </option>
                    ))}
                  </Select>
                </TD>
                <TD className="w-32">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
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
                <TD className="text-right tabular-nums text-slate-500">
                  {formatBRL(productById.get(newProductId)?.totalCost ?? 0)}
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
                <TD colSpan={3} className="text-right">
                  Custo total
                </TD>
                <TD className="text-right tabular-nums">{formatBRL(comboTotal)}</TD>
                <TD />
              </TR>
            </TBody>
          </Table>
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
        <Button type="button" onClick={save} disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Salvando…" : mode.type === "create" ? "Criar combo" : "Salvar combo"}
        </Button>
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
