"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Barcode,
  CheckCircle2,
  CreditCard,
  Plus,
  QrCode,
  Trash2,
  XCircle,
} from "lucide-react";
import { PaymentMethod } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
} from "@/server/actions/sales";

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
  const [showManual, setShowManual] = useState(false);
  const [manualKey, setManualKey] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [done, setDone] = useState<{ total: number; troco: number } | null>(null);
  const scanRef = useRef<HTMLInputElement | null>(null);

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

  function onScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sale) return;
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

  function onManualAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!sale) return;
    const entry = catalog.find((c) => `${c.kind}:${c.id}` === manualKey);
    const qty = Number(manualQty.replace(",", "."));
    if (!entry || !(qty > 0)) return;
    const payload =
      entry.kind === "PRODUTO"
        ? { productId: entry.id, quantity: qty }
        : { comboId: entry.id, quantity: qty };
    startTransition(async () => {
      const res = await addSaleItemAction(sale.id, payload);
      if (!res.ok) window.alert(res.error);
      setManualKey("");
      setManualQty("1");
      refresh();
    });
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
      <DoneScreen total={done.total} troco={done.troco} onNext={novaVenda} pending={isPending} />
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
      setDone({ total: sale.total, troco: totalTroco });
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
          <div className="flex items-center gap-3">
            <Barcode className="h-7 w-7 shrink-0 text-roxa-700" />
            <Input
              ref={scanRef}
              value={scan}
              onChange={(e) => setScan(e.currentTarget.value)}
              placeholder="Bipe a etiqueta ou o código do pacote"
              inputMode="numeric"
              autoComplete="off"
              disabled={isPending}
              className="h-12 text-lg"
            />
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
                <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-6 text-right text-xs tabular-nums text-slate-400">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{it.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatQty(it.quantity)} × {formatBRL(it.unitPrice)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatBRL(it.totalPrice)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(it.id)}
                    disabled={isPending}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="text-xs text-roxa-700 underline-offset-2 hover:underline"
          >
            {showManual ? "Esconder item manual" : "Adicionar item sem código"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"
          >
            <XCircle className="h-3.5 w-3.5" /> Cancelar venda
          </button>
        </div>

        {showManual && (
          <form onSubmit={onManualAdd} className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex-1">
              <Select value={manualKey} onChange={(e) => setManualKey(e.currentTarget.value)}>
                <option value="">— escolha o item —</option>
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
            </div>
            <Input
              type="number"
              step="0.001"
              min="0.001"
              value={manualQty}
              onChange={(e) => setManualQty(e.currentTarget.value)}
              className="w-24"
            />
            <Button type="submit" disabled={isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        )}
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

function DoneScreen({
  total,
  troco,
  onNext,
  pending,
}: {
  total: number;
  troco: number;
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
      <Button size="lg" onClick={onNext} disabled={pending} className="mt-4 px-10 py-6 text-lg">
        <Plus className="mr-2 h-5 w-5" /> Nova venda
      </Button>
    </div>
  );
}
