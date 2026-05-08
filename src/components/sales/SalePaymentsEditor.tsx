"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { PaymentMethod } from "@prisma/client";
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
import { formatBRL, formatPercent } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, enumOptions } from "@/lib/enums";
import {
  addSalePaymentAction,
  removeSalePaymentAction,
} from "@/server/actions/sales";

const METHOD_OPTIONS = enumOptions(PAYMENT_METHOD_LABEL);

export type SalePaymentRow = {
  id: string;
  method: PaymentMethod;
  amount: number;
  feePercent: number;
  feeAmount: number;
  netAmount: number;
};

export function SalePaymentsEditor({
  saleId,
  payments,
  defaultFees,
  readOnly,
}: {
  saleId: string;
  payments: SalePaymentRow[];
  defaultFees: { card: number; app: number };
  readOnly: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.DINHEIRO);
  const [amount, setAmount] = useState("");
  const [feeOverride, setFeeOverride] = useState("");

  function suggestedFee(m: PaymentMethod): number {
    if (m === "CARTAO_CREDITO" || m === "CARTAO_DEBITO") return defaultFees.card;
    if (m === "APP_IFOOD" || m === "APP_OUTRO") return defaultFees.app;
    return 0;
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const value = Number(amount.replace(",", "."));
    if (!(value > 0)) {
      setError("Valor deve ser maior que zero.");
      return;
    }
    const payload = {
      method,
      amount: value,
      feePercent: feeOverride === "" ? undefined : feeOverride,
    };
    startTransition(async () => {
      const res = await addSalePaymentAction(saleId, payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMethod(PaymentMethod.DINHEIRO);
      setAmount("");
      setFeeOverride("");
      router.refresh();
    });
  }

  function onRemove(id: string) {
    startTransition(async () => {
      const res = await removeSalePaymentAction(id, saleId);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const totalFees = payments.reduce((acc, p) => acc + p.feeAmount, 0);
  const totalNet = totalPaid - totalFees;
  const suggested = suggestedFee(method);

  return (
    <div className="space-y-4">
      {!readOnly && (
        <form onSubmit={onAdd} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <Field label="Forma de pagamento">
              <Select
                value={method}
                onChange={(e) => setMethod(e.currentTarget.value as PaymentMethod)}
              >
                {METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Valor (R$)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.currentTarget.value)}
              />
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field
              label="Taxa (%)"
              hint={
                suggested > 0
                  ? `Padrão p/ ${PAYMENT_METHOD_LABEL[method]}: ${(suggested * 100).toFixed(2)}%`
                  : "Sem taxa por padrão"
              }
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder={(suggested * 100).toFixed(2)}
                value={feeOverride}
                onChange={(e) => setFeeOverride(e.currentTarget.value)}
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

      {payments.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Nenhum pagamento registrado.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Forma</TH>
              <TH className="text-right">Valor</TH>
              <TH className="text-right">Taxa</TH>
              <TH className="text-right">Líquido</TH>
              {!readOnly && <TH className="w-12"></TH>}
            </TR>
          </THead>
          <TBody>
            {payments.map((p) => (
              <TR key={p.id}>
                <TD className="font-medium text-slate-900">
                  {PAYMENT_METHOD_LABEL[p.method]}
                </TD>
                <TD className="text-right tabular-nums">{formatBRL(p.amount)}</TD>
                <TD className="text-right tabular-nums text-slate-500 text-xs">
                  {p.feePercent > 0
                    ? `${formatPercent(p.feePercent)} (${formatBRL(p.feeAmount)})`
                    : "—"}
                </TD>
                <TD className="text-right tabular-nums font-medium">
                  {formatBRL(p.netAmount)}
                </TD>
                {!readOnly && (
                  <TD className="text-right pr-2">
                    <button
                      type="button"
                      onClick={() => onRemove(p.id)}
                      disabled={isPending}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {payments.length > 0 && (
        <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1 text-sm">
          <span className="text-slate-500">
            Pago: <span className="font-medium text-slate-700 tabular-nums">{formatBRL(totalPaid)}</span>
          </span>
          <span className="text-slate-500">
            Taxas: <span className="font-medium text-slate-700 tabular-nums">{formatBRL(totalFees)}</span>
          </span>
          <span className="text-slate-500">
            Líquido: <span className="text-base font-semibold text-slate-900 tabular-nums">{formatBRL(totalNet)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
