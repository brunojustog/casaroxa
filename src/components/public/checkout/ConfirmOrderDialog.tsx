"use client";

import { AlertTriangle, Edit3, MapPin, ShoppingBag } from "lucide-react";

type Item = { name: string; quantity: number; totalPrice: number };

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Modal de confirmação antes de finalizar — última chance pro cliente
 * conferir o endereço (principalmente quando veio pré-carregado e ele
 * pode estar pedindo de outro lugar).
 */
export function ConfirmOrderDialog({
  open,
  onClose,
  onConfirm,
  onEditAddress,
  submitting,
  items,
  subtotal,
  deliveryFee = 0,
  couponCode,
  couponDiscount,
  total,
  deliveryMode,
  address,
  addressNumber,
  addressComplement,
  neighborhood,
  reference,
  customerName,
  customerPhone,
  addressFromCustomer,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onEditAddress: () => void;
  submitting: boolean;
  items: Item[];
  subtotal: number;
  /// Taxa de entrega já inclusa no total (0 = sem taxa / retirada).
  deliveryFee?: number;
  couponCode: string | null;
  couponDiscount: number;
  total: number;
  deliveryMode: "PICKUP" | "DELIVERY";
  address: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  addressFromCustomer: boolean;
}) {
  if (!open) return null;

  const enderecoLinha1 =
    [address, addressNumber ? `nº ${addressNumber}` : null, addressComplement]
      .filter(Boolean)
      .join(", ");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-slate-200 px-5 py-3">
          <h3 className="font-serif text-lg font-semibold text-roxa-900">
            Confirme seu pedido
          </h3>
          <p className="text-xs text-slate-500">
            Última conferida antes de enviar pra Casa Roxa.
          </p>
        </header>

        <div className="p-5 space-y-5">
          {/* Resumo */}
          <section>
            <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2 inline-flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              Itens
            </h4>
            <ul className="space-y-1 text-sm">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-slate-700">
                    {it.quantity}× {it.name}
                  </span>
                  <span className="tabular-nums text-slate-900">
                    {fmt(it.totalPrice)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 text-sm border-t border-slate-100 pt-2">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{fmt(subtotal)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Taxa de entrega</span>
                  <span className="tabular-nums">{fmt(deliveryFee)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Cupom {couponCode}</span>
                  <span className="tabular-nums">−{fmt(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-slate-900 pt-1">
                <span>Total</span>
                <span className="tabular-nums">{fmt(total)}</span>
              </div>
            </div>
          </section>

          {/* Endereço de entrega — destaque! */}
          {deliveryMode === "DELIVERY" ? (
            <section>
              <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2 inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Entregaremos em
              </h4>
              <div
                className={
                  addressFromCustomer
                    ? "rounded-lg border-2 border-amber-300 bg-amber-50 p-4"
                    : "rounded-lg border border-roxa-200 bg-roxa-50/50 p-4"
                }
              >
                <p className="font-semibold text-slate-900 leading-tight">
                  {enderecoLinha1 || "(endereço incompleto)"}
                </p>
                {neighborhood && (
                  <p className="text-sm text-slate-700">{neighborhood}</p>
                )}
                {reference && (
                  <p className="text-xs text-slate-600 mt-1">
                    Ref: {reference}
                  </p>
                )}
                {addressFromCustomer && (
                  <div className="mt-3 flex items-start gap-1.5 text-xs text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Endereço carregado do seu cadastro. <strong>Está
                      pedindo de outro lugar hoje?</strong> Edite antes de
                      finalizar.
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onEditAddress}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-roxa-700 hover:underline"
              >
                <Edit3 className="h-3 w-3" />
                Editar endereço
              </button>
            </section>
          ) : (
            <section className="rounded-lg border border-roxa-200 bg-roxa-50/50 p-4 text-sm">
              <p className="font-semibold text-roxa-900">🛍 Retirada no local</p>
              <p className="text-xs text-slate-600 mt-1">
                Combinaremos o horário pelo WhatsApp.
              </p>
            </section>
          )}

          <section className="text-sm space-y-0.5">
            <p className="font-medium text-slate-900">{customerName}</p>
            <p className="text-xs text-slate-500 tabular-nums">{customerPhone}</p>
          </section>
        </div>

        <footer className="flex flex-col-reverse sm:flex-row gap-2 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-green-600 px-5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? "Enviando…" : "Confirmar e finalizar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
