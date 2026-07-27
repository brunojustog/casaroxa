"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Barcode,
  CheckCircle2,
  CreditCard,
  Pencil,
  Plus,
  QrCode,
  Trash2,
  XCircle,
} from "lucide-react";
import { PaymentMethod } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/enums";
import {
  parseScannedCode,
  type ScanCatalogEntry,
} from "@/lib/scale-barcode";
import {
  addSaleItemAction,
  addSalePaymentAction,
  cancelSaleAction,
  concludeSaleAction,
  createSaleAction,
  removeSaleItemAction,
  removeSalePaymentAction,
  updateSaleItemAction,
} from "@/server/actions/sales";

/** Busca sem acento/caixa: "linguica" acha "Linguiça". */
function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export type PdvItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type PdvPayment = {
  id: string;
  method: PaymentMethod;
  amount: number;
  receivedAmount: number | null;
};

export type PdvSale = {
  id: string;
  number: number;
  items: PdvItem[];
  payments: PdvPayment[];
  total: number;
  totalPaid: number;
};

const QUICK_METHODS: { method: PaymentMethod; icon: typeof Banknote }[] = [
  { method: PaymentMethod.DINHEIRO, icon: Banknote },
  { method: PaymentMethod.PIX, icon: QrCode },
  { method: PaymentMethod.CARTAO_DEBITO, icon: CreditCard },
  { method: PaymentMethod.CARTAO_CREDITO, icon: CreditCard },
];

function formatQty(q: number) {
  return Number.isInteger(q)
    ? String(q)
    : q.toFixed(3).replace(".", ",").replace(/0+$/, "").replace(/,$/, "");
}

export function PdvClient({
  sale,
  catalog,
}: {
  sale: PdvSale | null;
  catalog: ScanCatalogEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scan, setScan] = useState("");
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  const [received, setReceived] = useState("");
  const [discount, setDiscount] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [done, setDone] = useState<{ total: number; troco: number; saleId: string } | null>(
    null,
  );
  const scanRef = useRef<HTMLInputElement | null>(null);

  // Digitou letra no campo de bipar → vira busca pelo nome (com sugestões).
  const isSearch = /[a-zA-ZÀ-ÿ]/.test(scan);
  const suggestions = useMemo(() => {
    if (!isSearch) return [];
    const terms = normalize(scan).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return catalog
      .filter((c) => {
        const name = normalize(c.name);
        return terms.every((t) => name.includes(t)) && c.salePrice > 0;
      })
      .slice(0, 8);
  }, [scan, isSearch, catalog]);

  // Bipar sempre focado enquanto a venda está aberta.
  useEffect(() => {
    if (sale && !payMethod) scanRef.current?.focus();
  }, [sale, payMethod]);

  function refresh() {
    router.refresh();
  }

  function novaVenda() {
    setDone(null);
    setPayMethod(null);
    setReceived("");
    setDiscount("");
    startTransition(async () => {
      const res = await createSaleAction({ source: "LOJA" });
      if (!res.ok) window.alert(res.error);
      refresh();
    });
  }

  /** Adiciona um item do catálogo (busca pelo nome) — 1 un/kg por padrão. */
  function addEntry(entry: ScanCatalogEntry) {
    if (!sale) return;
    setScan("");
    setHighlight(0);
    const payload =
      entry.kind === "PRODUTO"
        ? { productId: entry.id, quantity: 1 }
        : { comboId: entry.id, quantity: 1 };
    startTransition(async () => {
      const res = await addSaleItemAction(sale.id, payload);
      if (!res.ok) {
        setScanMsg(res.error);
        return;
      }
      setScanMsg(`✓ ${entry.name} — 1 un. (ajuste qtd/preço no lápis, se precisar)`);
      refresh();
    });
    scanRef.current?.focus();
  }

  function onScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sale) return;

    // Modo busca: Enter adiciona a sugestão destacada.
    if (isSearch) {
      const entry = suggestions[highlight] ?? suggestions[0];
      if (entry) addEntry(entry);
      return;
    }

    const code = scan;
    setScan("");
    setScanMsg(null);
    const result = parseScannedCode(code, catalog);
    if (!result) return;
    if (result.type === "error") {
      setScanMsg(result.message);
      return;
    }
    const qty = result.type === "scale" ? result.quantity : 1;
    startTransition(async () => {
      const res = await addSaleItemAction(sale.id, {
        productId: result.entry.id,
        quantity: qty,
      });
      if (!res.ok) {
        setScanMsg(res.error);
        return;
      }
      setScanMsg(
        result.type === "scale"
          ? `✓ ${result.entry.name} — ${qty.toFixed(3).replace(".", ",")} kg (${formatBRL(result.priceCents / 100)})`
          : `✓ ${result.entry.name} — 1 un.`,
      );
      refresh();
    });
    scanRef.current?.focus();
  }

  function onScanKeyDown(e: React.KeyboardEvent) {
    if (!isSearch || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Escape") {
      setScan("");
      setHighlight(0);
    }
  }

  function onRemoveItem(itemId: string) {
    if (!sale) return;
    startTransition(async () => {
      const res = await removeSaleItemAction(itemId, sale.id);
      if (!res.ok) window.alert(res.error);
      refresh();
    });
  }

  function onRemovePayment(paymentId: string) {
    if (!sale) return;
    startTransition(async () => {
      const res = await removeSalePaymentAction(paymentId, sale.id);
      if (!res.ok) window.alert(res.error);
      refresh();
    });
  }

  function onCancel() {
    if (!sale) return;
    if (!window.confirm(`Cancelar a venda #${sale.number}?`)) return;
    startTransition(async () => {
      const res = await cancelSaleAction(sale.id, "Cancelada no PDV");
      if (!res.ok) window.alert(res.error);
      refresh();
    });
  }

  if (!sale) {
    return done ? (
      <DoneScreen
        total={done.total}
        troco={done.troco}
        saleId={done.saleId}
        onNext={novaVenda}
        pending={isPending}
      />
    ) : (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-slate-500">Nenhuma venda aberta no caixa.</p>
        <Button size="lg" onClick={novaVenda} disabled={isPending} className="px-10 py-6 text-lg">
          <Plus className="mr-2 h-5 w-5" /> Iniciar venda
        </Button>
      </div>
    );
  }

  const discountValue = Math.max(0, Number(discount.replace(",", ".")) || 0);
  const restante = Math.max(0, sale.total - sale.totalPaid - discountValue);
  const receivedValue = Number(received.replace(",", ".")) || 0;
  const troco = payMethod === "DINHEIRO" ? Math.max(0, receivedValue - restante) : 0;
  const canConclude = sale.items.length > 0 && restante <= 0.005;

  function onConfirmPayment() {
    if (!sale || !payMethod || restante <= 0) return;
    if (payMethod === "DINHEIRO" && receivedValue > 0 && receivedValue < restante - 0.005) {
      window.alert("Valor recebido menor que o restante.");
      return;
    }
    startTransition(async () => {
      const res = await addSalePaymentAction(sale.id, {
        method: payMethod,
        amount: restante,
        receivedAmount:
          payMethod === "DINHEIRO" && receivedValue > 0 ? receivedValue : undefined,
      });
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      setPayMethod(null);
      setReceived("");
      refresh();
    });
  }

  function onConclude() {
    if (!sale) return;
    const totalTroco = sale.payments.reduce((acc, p) => {
      const r = p.receivedAmount ?? 0;
      return acc + Math.max(0, r - p.amount);
    }, 0);
    startTransition(async () => {
      const res = await concludeSaleAction(sale.id);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      setDone({ total: sale.total, troco: totalTroco, saleId: sale.id });
      refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {/* Coluna principal: bipar + itens */}
      <div className="space-y-3 lg:col-span-3">
        <form
          onSubmit={onScanSubmit}
          className="rounded-xl border-2 border-dashed border-roxa-300 bg-roxa-50/60 p-4"
        >
          <div className="relative flex items-center gap-3">
            <Barcode className="h-7 w-7 shrink-0 text-roxa-700" />
            <Input
              ref={scanRef}
              value={scan}
              onChange={(e) => {
                setScan(e.currentTarget.value);
                setHighlight(0);
              }}
              onKeyDown={onScanKeyDown}
              placeholder="Bipe a etiqueta / código — ou digite o nome do item"
              autoComplete="off"
              disabled={isPending}
              className="h-12 text-lg"
            />
            {isSearch && (
              <ul className="absolute left-10 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {suggestions.length === 0 ? (
                  <li className="px-4 py-2.5 text-sm text-slate-400">
                    Nenhum item com esse nome.
                  </li>
                ) : (
                  suggestions.map((s, i) => (
                    <li key={`${s.kind}:${s.id}`}>
                      <button
                        type="button"
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => addEntry(s)}
                        className={`flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left text-sm ${
                          i === highlight ? "bg-roxa-50 text-roxa-900" : "text-slate-700"
                        }`}
                      >
                        <span className="truncate">
                          {s.name}
                          {s.kind === "COMBO" && (
                            <span className="ml-1.5 text-xs text-slate-400">combo</span>
                          )}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-500">
                          {formatBRL(s.salePrice)}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          {/* Submit invisível: garante que o Enter do leitor dispare o form. */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
          {scanMsg && (
            <p
              className={`mt-2 text-sm ${scanMsg.startsWith("✓") ? "text-green-700" : "text-red-700"}`}
            >
              {scanMsg}
            </p>
          )}
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {sale.items.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">
              Venda #{sale.number} — bipe o primeiro item.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sale.items.map((it, idx) => (
                <PdvItemRow
                  key={it.id}
                  item={it}
                  index={idx}
                  saleId={sale.id}
                  disabled={isPending}
                  onRemove={() => onRemoveItem(it.id)}
                  onSaved={refresh}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"
          >
            <XCircle className="h-3.5 w-3.5" /> Cancelar venda
          </button>
        </div>
      </div>

      {/* Coluna do pagamento */}
      <div className="space-y-3 lg:col-span-2">
        <div className="rounded-xl bg-roxa-700 p-5 text-white">
          <p className="text-xs uppercase tracking-wide text-roxa-100">Total</p>
          <p className="text-4xl font-bold tabular-nums">{formatBRL(sale.total)}</p>
          {discountValue > 0 && (
            <p className="mt-1 text-sm text-roxa-100">
              Desconto: {formatBRL(discountValue)} → a cobrar {formatBRL(Math.max(0, sale.total - discountValue))}
            </p>
          )}
          {sale.totalPaid > 0 && (
            <p className="mt-1 text-sm text-roxa-100">
              Pago: {formatBRL(sale.totalPaid)} · Restante: {formatBRL(restante)}
            </p>
          )}
        </div>

        {sale.payments.length > 0 && (
          <ul className="space-y-1">
            {sale.payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span>
                  {PAYMENT_METHOD_LABEL[p.method]}
                  {p.receivedAmount != null && p.receivedAmount > p.amount && (
                    <span className="ml-2 text-xs text-slate-500">
                      (recebido {formatBRL(p.receivedAmount)}, troco {formatBRL(p.receivedAmount - p.amount)})
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{formatBRL(p.amount)}</span>
                  <button
                    type="button"
                    onClick={() => onRemovePayment(p.id)}
                    disabled={isPending}
                    className="rounded p-1 text-slate-400 hover:text-red-600"
                    title="Remover pagamento"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {restante > 0.005 && sale.items.length > 0 && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">Forma de pagamento</p>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Desconto R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.currentTarget.value)}
                  className="h-8 w-20 text-right"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_METHODS.map(({ method, icon: Icon }) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setPayMethod(method);
                    setReceived("");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition ${
                    payMethod === method
                      ? "border-roxa-600 bg-roxa-50 text-roxa-800"
                      : "border-slate-200 bg-white text-slate-700 hover:border-roxa-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {PAYMENT_METHOD_LABEL[method]}
                </button>
              ))}
            </div>

            {payMethod === "DINHEIRO" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Recebido R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={received}
                    onChange={(e) => setReceived(e.currentTarget.value)}
                    className="h-11 flex-1 text-right text-lg tabular-nums"
                    placeholder={restante.toFixed(2)}
                  />
                </div>
                {receivedValue > 0 && (
                  <p className="rounded-lg bg-green-50 px-3 py-2 text-center text-lg font-bold text-green-700">
                    Troco: {formatBRL(troco)}
                  </p>
                )}
              </div>
            )}

            {payMethod && (
              <Button
                onClick={onConfirmPayment}
                disabled={isPending}
                className="w-full py-3 text-base"
              >
                Registrar {PAYMENT_METHOD_LABEL[payMethod]} — {formatBRL(restante)}
              </Button>
            )}
          </div>
        )}

        <Button
          onClick={onConclude}
          disabled={!canConclude || isPending}
          className="w-full py-4 text-lg"
        >
          <CheckCircle2 className="mr-2 h-5 w-5" />
          Concluir venda
        </Button>
        {!canConclude && sale.items.length > 0 && restante > 0.005 && (
          <p className="text-center text-xs text-slate-400">
            Registre o pagamento pra concluir.
          </p>
        )}
      </div>
    </div>
  );
}

function PdvItemRow({
  item,
  index,
  saleId,
  disabled,
  onRemove,
  onSaved,
}: {
  item: PdvItem;
  index: number;
  saleId: string;
  disabled: boolean;
  onRemove: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.unitPrice));
  const [itemDiscount, setItemDiscount] = useState("");

  const numQty = Number(qty.replace(",", ".")) || 0;
  const numPrice = Number(price.replace(",", ".")) || 0;
  const numDiscount = Math.max(0, Number(itemDiscount.replace(",", ".")) || 0);
  // Desconto do item vira ajuste no preço unitário (o total re-calcula no server).
  const finalUnit =
    numQty > 0 ? Math.max(0, Number((numPrice - numDiscount / numQty).toFixed(2))) : 0;
  const preview = Number((numQty * finalUnit).toFixed(2));
  const isPending = pending || disabled;

  function openEdit() {
    setQty(String(item.quantity));
    setPrice(String(item.unitPrice));
    setItemDiscount("");
    setEditing(true);
  }

  function save() {
    if (!(numQty > 0) || finalUnit < 0) return;
    startTransition(async () => {
      const res = await updateSaleItemAction(item.id, saleId, {
        quantity: numQty,
        unitPrice: finalUnit,
      });
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      setEditing(false);
      onSaved();
    });
  }

  const discounted = item.totalPrice < Number((item.quantity * item.unitPrice).toFixed(2)) - 0.005;

  return (
    <li className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="w-6 text-right text-xs tabular-nums text-slate-400">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
          <p className="text-xs text-slate-500">
            {formatQty(item.quantity)} × {formatBRL(item.unitPrice)}
            {discounted && <span className="ml-1.5 text-roxa-600">(c/ desconto)</span>}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {formatBRL(item.totalPrice)}
        </span>
        <button
          type="button"
          onClick={editing ? () => setEditing(false) : openEdit}
          disabled={isPending}
          className={`rounded-md p-1.5 disabled:opacity-50 ${
            editing
              ? "bg-roxa-100 text-roxa-700"
              : "text-slate-400 hover:bg-roxa-50 hover:text-roxa-700"
          }`}
          title="Editar qtd / preço / desconto do item"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={isPending}
          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          title="Remover item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {editing && (
        <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
          <label className="text-xs text-slate-600">
            Qtd
            <Input
              type="number"
              step="0.001"
              min="0.001"
              value={qty}
              onChange={(e) => setQty(e.currentTarget.value)}
              className="mt-1 h-9 w-24 text-right tabular-nums"
            />
          </label>
          <label className="text-xs text-slate-600">
            Preço unit. R$
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.currentTarget.value)}
              className="mt-1 h-9 w-28 text-right tabular-nums"
            />
          </label>
          <label className="text-xs text-slate-600">
            Desconto no item R$
            <Input
              type="number"
              step="0.01"
              min="0"
              value={itemDiscount}
              onChange={(e) => setItemDiscount(e.currentTarget.value)}
              placeholder="0,00"
              className="mt-1 h-9 w-28 text-right tabular-nums"
            />
          </label>
          <div className="flex-1 text-right text-sm">
            <span className="text-slate-500">Novo total: </span>
            <span className="font-semibold tabular-nums text-roxa-700">{formatBRL(preview)}</span>
          </div>
          <Button onClick={save} disabled={isPending || !(numQty > 0)} className="h-9">
            Aplicar
          </Button>
        </div>
      )}
    </li>
  );
}

function DoneScreen({
  total,
  troco,
  saleId,
  onNext,
  pending,
}: {
  total: number;
  troco: number;
  saleId: string;
  onNext: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <CheckCircle2 className="h-14 w-14 text-green-600" />
      <p className="text-2xl font-bold text-slate-900">Venda concluída — {formatBRL(total)}</p>
      {troco > 0 && (
        <p className="rounded-lg bg-green-50 px-6 py-3 text-3xl font-bold text-green-700">
          Troco: {formatBRL(troco)}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() =>
            window.open(`/pdv-cupom/${saleId}`, "_blank", "width=320,height=640")
          }
          className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-700 hover:border-roxa-400 hover:text-roxa-700"
        >
          🖨️ Imprimir cupom
        </button>
        <Button size="lg" onClick={onNext} disabled={pending} className="px-10 py-6 text-lg">
          <Plus className="mr-2 h-5 w-5" /> Nova venda
        </Button>
      </div>
    </div>
  );
}
