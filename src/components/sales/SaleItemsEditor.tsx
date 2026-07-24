"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/format";
import {
  addSaleItemAction,
  removeSaleItemAction,
  updateSaleItemAction,
} from "@/server/actions/sales";

type CatalogEntry = {
  kind: "PRODUTO" | "COMBO";
  id: string;
  name: string;
  salePrice: number;
  /** Código do item na balança (6 dígitos) — etiqueta EAN "2CCCCCCVVVVVD". */
  scaleCode?: string | null;
  /** Código de barras de fábrica (EAN-8/13) — produtos de pacote. */
  barcode?: string | null;
};

export type SaleItemRow = {
  id: string;
  productId: string | null;
  comboId: string | null;
  productName: string | null;
  comboName: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  totalPrice: number;
  totalCost: number;
  notes: string | null;
};

export function SaleItemsEditor({
  saleId,
  items,
  catalog,
  readOnly,
}: {
  saleId: string;
  items: SaleItemRow[];
  catalog: CatalogEntry[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [priceOverride, setPriceOverride] = useState("");
  const [scan, setScan] = useState("");
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement | null>(null);

  const selected = catalog.find((c) => `${c.kind}:${c.id}` === selectedKey);

  /**
   * Interpreta o código bipado pelo leitor:
   *  - Etiqueta da balança Toledo: EAN-13 "2CCCCCCVVVVVD" — CCCCCC é o
   *    scaleCode e VVVVV o PREÇO em centavos. Quantidade = preço ÷ preço/kg.
   *  - Código de fábrica (EAN-8/13): casa com Product.barcode, adiciona 1 un.
   */
  function handleScan(raw: string) {
    const code = raw.replace(/\D/g, "");
    setScanMsg(null);
    if (!code) return;

    if (code.length === 13 && code.startsWith("2")) {
      const scaleCode = code.slice(1, 7);
      const priceCents = parseInt(code.slice(7, 12), 10);
      const prod = catalog.find(
        (c) => c.kind === "PRODUTO" && c.scaleCode === scaleCode,
      );
      if (!prod) {
        setScanMsg(`Nenhum produto com código de balança ${scaleCode}.`);
        return;
      }
      if (!(prod.salePrice > 0) || !(priceCents > 0)) {
        setScanMsg(`"${prod.name}" sem preço válido pra calcular o peso.`);
        return;
      }
      // Etiqueta traz o TOTAL em R$; convertemos pra quantidade (kg) com
      // 3 casas — o total re-calculado bate com a etiqueta (± 1 centavo).
      const qty = Number((priceCents / 100 / prod.salePrice).toFixed(3));
      startTransition(async () => {
        const res = await addSaleItemAction(saleId, {
          productId: prod.id,
          quantity: qty,
        });
        if (!res.ok) {
          setScanMsg(res.error);
          return;
        }
        setScanMsg(`✓ ${prod.name} — ${qty.toFixed(3).replace(".", ",")} kg (R$ ${(priceCents / 100).toFixed(2).replace(".", ",")})`);
        router.refresh();
      });
      return;
    }

    const prod = catalog.find((c) => c.kind === "PRODUTO" && c.barcode === code);
    if (!prod) {
      setScanMsg(
        `Código ${code} não cadastrado. Cadastre no produto (campo Código de barras).`,
      );
      return;
    }
    startTransition(async () => {
      const res = await addSaleItemAction(saleId, {
        productId: prod.id,
        quantity: 1,
      });
      if (!res.ok) {
        setScanMsg(res.error);
        return;
      }
      setScanMsg(`✓ ${prod.name} — 1 un.`);
      router.refresh();
    });
  }

  function onScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = scan;
    setScan("");
    handleScan(code);
    scanRef.current?.focus();
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError("Escolha um produto ou combo.");
      return;
    }
    const qty = Number(quantity.replace(",", "."));
    if (!(qty > 0)) {
      setError("Quantidade deve ser maior que zero.");
      return;
    }
    const payload =
      selected.kind === "PRODUTO"
        ? { productId: selected.id, quantity: qty, unitPrice: priceOverride || undefined }
        : { comboId: selected.id, quantity: qty, unitPrice: priceOverride || undefined };

    startTransition(async () => {
      const res = await addSaleItemAction(saleId, payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSelectedKey("");
      setQuantity("1");
      setPriceOverride("");
      router.refresh();
    });
  }

  function onRemove(itemId: string) {
    startTransition(async () => {
      const res = await removeSaleItemAction(itemId, saleId);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  const totalRevenue = items.reduce((acc, i) => acc + i.totalPrice, 0);
  const totalCost = items.reduce((acc, i) => acc + i.totalCost, 0);
  const cmv = totalRevenue > 0 ? totalCost / totalRevenue : null;

  return (
    <div className="space-y-4">
      {!readOnly && (
        <form
          onSubmit={onScanSubmit}
          className="rounded-lg border-2 border-dashed border-roxa-200 bg-roxa-50/40 p-3"
        >
          <div className="flex items-center gap-2">
            <Barcode className="h-5 w-5 shrink-0 text-roxa-700" />
            <Input
              ref={scanRef}
              value={scan}
              onChange={(e) => setScan(e.currentTarget.value)}
              placeholder="Clique aqui e bipe a etiqueta da balança ou o código do pacote"
              inputMode="numeric"
              autoComplete="off"
              disabled={isPending}
            />
          </div>
          {scanMsg && (
            <p
              className={`mt-2 text-xs ${
                scanMsg.startsWith("✓") ? "text-green-700" : "text-red-700"
              }`}
            >
              {scanMsg}
            </p>
          )}
        </form>
      )}

      {!readOnly && (
        <form onSubmit={onAdd} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <Field label="Produto ou combo">
              <Select
                value={selectedKey}
                onChange={(e) => {
                  setSelectedKey(e.currentTarget.value);
                  setPriceOverride("");
                }}
              >
                <option value="">— escolha —</option>
                <optgroup label="Produtos">
                  {catalog
                    .filter((c) => c.kind === "PRODUTO")
                    .map((c) => (
                      <option key={`PRODUTO:${c.id}`} value={`PRODUTO:${c.id}`}>
                        {c.name} — {formatBRL(c.salePrice)}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Combos">
                  {catalog
                    .filter((c) => c.kind === "COMBO")
                    .map((c) => (
                      <option key={`COMBO:${c.id}`} value={`COMBO:${c.id}`}>
                        {c.name} — {formatBRL(c.salePrice)}
                      </option>
                    ))}
                </optgroup>
              </Select>
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Qtd">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.currentTarget.value)}
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field
              label={`Preço unit. (R$)`}
              hint={selected ? `Padrão: ${formatBRL(selected.salePrice)}` : "Escolha um item primeiro"}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={selected ? String(selected.salePrice) : ""}
                value={priceOverride}
                onChange={(e) => setPriceOverride(e.currentTarget.value)}
              />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Button type="submit" size="md" disabled={isPending} className="w-full">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Nenhum item adicionado.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Item</TH>
              <TH className="text-right">Qtd</TH>
              <TH className="text-right">Preço unit.</TH>
              <TH className="text-right">Total</TH>
              <TH className="text-right">Custo</TH>
              {!readOnly && <TH className="w-32"></TH>}
            </TR>
          </THead>
          <TBody>
            {items.map((it) =>
              readOnly ? (
                <ReadOnlyRow key={it.id} item={it} />
              ) : (
                <EditableRow
                  key={it.id}
                  item={it}
                  saleId={saleId}
                  onRemove={() => onRemove(it.id)}
                  disabled={isPending}
                />
              ),
            )}
          </TBody>
        </Table>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1 text-sm">
          <span className="text-slate-500">
            Custo total: <span className="font-medium text-slate-700 tabular-nums">{formatBRL(totalCost)}</span>
          </span>
          {cmv !== null && (
            <span className="text-slate-500">
              CMV: <span className="font-medium text-slate-700 tabular-nums">{(cmv * 100).toFixed(1)}%</span>
            </span>
          )}
          <span className="text-slate-500">
            Bruto: <span className="text-base font-semibold text-slate-900 tabular-nums">{formatBRL(totalRevenue)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function ReadOnlyRow({ item: it }: { item: SaleItemRow }) {
  return (
    <TR>
      <TD className="font-medium text-slate-900">
        {it.productName ?? it.comboName}
        <span className="ml-2 text-xs text-slate-400">
          {it.productId ? "Produto" : "Combo"}
        </span>
      </TD>
      <TD className="text-right tabular-nums">{it.quantity}</TD>
      <TD className="text-right tabular-nums">{formatBRL(it.unitPrice)}</TD>
      <TD className="text-right tabular-nums font-medium">{formatBRL(it.totalPrice)}</TD>
      <TD className="text-right tabular-nums text-slate-500 text-xs">{formatBRL(it.totalCost)}</TD>
    </TR>
  );
}

function EditableRow({
  item,
  saleId,
  onRemove,
  disabled,
}: {
  item: SaleItemRow;
  saleId: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.unitPrice));
  const [rowError, setRowError] = useState<string | null>(null);

  const numQty = Number(qty.replace(",", ".")) || 0;
  const numPrice = Number(price.replace(",", ".")) || 0;
  const livePreview = numQty * numPrice;

  // Considera "modificado" se diferente dos valores originais (com tolerância de centavo).
  const dirty =
    Math.abs(numQty - item.quantity) > 0.0001 ||
    Math.abs(numPrice - item.unitPrice) > 0.005;

  function reset() {
    setQty(String(item.quantity));
    setPrice(String(item.unitPrice));
    setRowError(null);
  }

  function save() {
    setRowError(null);
    if (!(numQty > 0)) {
      setRowError("Quantidade > 0");
      return;
    }
    if (numPrice < 0) {
      setRowError("Preço >= 0");
      return;
    }
    startTransition(async () => {
      const res = await updateSaleItemAction(item.id, saleId, {
        quantity: numQty,
        unitPrice: numPrice,
      });
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const isPending = pending || disabled;

  return (
    <TR>
      <TD className="font-medium text-slate-900">
        {item.productName ?? item.comboName}
        <span className="ml-2 text-xs text-slate-400">
          {item.productId ? "Produto" : "Combo"}
        </span>
        {rowError && (
          <p className="mt-0.5 text-[11px] text-red-600">{rowError}</p>
        )}
      </TD>
      <TD className="text-right">
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={qty}
          onChange={(e) => setQty(e.currentTarget.value)}
          disabled={isPending}
          className="ml-auto h-8 w-20 text-right tabular-nums"
        />
      </TD>
      <TD className="text-right">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.currentTarget.value)}
          disabled={isPending}
          className="ml-auto h-8 w-24 text-right tabular-nums"
        />
      </TD>
      <TD className="text-right tabular-nums font-medium">
        {dirty ? (
          <span className="text-slate-500">
            <span className="line-through text-slate-300 text-xs">
              {formatBRL(item.totalPrice)}
            </span>{" "}
            <span className="text-roxa-700">{formatBRL(livePreview)}</span>
          </span>
        ) : (
          formatBRL(item.totalPrice)
        )}
      </TD>
      <TD className="text-right tabular-nums text-slate-500 text-xs">
        {formatBRL(item.totalCost)}
      </TD>
      <TD className="text-right pr-2">
        <div className="flex items-center justify-end gap-0.5">
          {dirty && (
            <>
              <button
                type="button"
                onClick={save}
                disabled={isPending}
                className="rounded-md p-1.5 text-green-700 hover:bg-green-50 disabled:opacity-50"
                title="Salvar alterações"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={isPending}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                title="Desfazer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={isPending}
            className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            title="Remover"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </TD>
    </TR>
  );
}
