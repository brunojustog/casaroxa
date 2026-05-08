"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ImageOff,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useCart, cartKeyOf } from "@/components/public/cart/CartProvider";

type SiteSettingsForCheckout = {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFeeNote: string | null;
  minimumOrderValue: number | null;
  whatsappNumber: string | null;
};

type DeliveryMode = "PICKUP" | "DELIVERY";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function CheckoutClient({ settings }: { settings: SiteSettingsForCheckout }) {
  const router = useRouter();
  const { cart, count, total, hydrated, setQty, remove, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const initialMode: DeliveryMode = settings.pickupEnabled
    ? "PICKUP"
    : settings.deliveryEnabled
      ? "DELIVERY"
      : "PICKUP";
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(initialMode);
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [reference, setReference] = useState("");
  const [paymentHint, setPaymentHint] = useState("");
  const [notes, setNotes] = useState("");

  // Persist form em sessionStorage pra não perder ao trocar página
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("casaroxa.checkout.v1");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.customerName) setCustomerName(d.customerName);
        if (d.customerPhone) setCustomerPhone(d.customerPhone);
        if (d.deliveryMode) setDeliveryMode(d.deliveryMode);
        if (d.address) setAddress(d.address);
        if (d.addressNumber) setAddressNumber(d.addressNumber);
        if (d.addressComplement) setAddressComplement(d.addressComplement);
        if (d.neighborhood) setNeighborhood(d.neighborhood);
        if (d.reference) setReference(d.reference);
        if (d.paymentHint) setPaymentHint(d.paymentHint);
        if (d.notes) setNotes(d.notes);
      }
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "casaroxa.checkout.v1",
        JSON.stringify({
          customerName,
          customerPhone,
          deliveryMode,
          address,
          addressNumber,
          addressComplement,
          neighborhood,
          reference,
          paymentHint,
          notes,
        }),
      );
    } catch {
      /* ignora */
    }
  }, [
    customerName,
    customerPhone,
    deliveryMode,
    address,
    addressNumber,
    addressComplement,
    neighborhood,
    reference,
    paymentHint,
    notes,
  ]);

  const minOrder = settings.minimumOrderValue ?? 0;
  const belowMinimum = minOrder > 0 && total < minOrder;

  const canSubmit = useMemo(() => {
    if (count === 0) return false;
    if (belowMinimum) return false;
    if (!customerName.trim() || !customerPhone.trim()) return false;
    if (deliveryMode === "DELIVERY") {
      if (!address.trim() || !neighborhood.trim()) return false;
    }
    return true;
  }, [
    count,
    belowMinimum,
    customerName,
    customerPhone,
    deliveryMode,
    address,
    neighborhood,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          deliveryMode,
          address: deliveryMode === "DELIVERY" ? address : undefined,
          addressNumber: deliveryMode === "DELIVERY" ? addressNumber : undefined,
          addressComplement:
            deliveryMode === "DELIVERY" ? addressComplement : undefined,
          neighborhood: deliveryMode === "DELIVERY" ? neighborhood : undefined,
          reference: deliveryMode === "DELIVERY" ? reference : undefined,
          paymentHint,
          notes,
          items: cart.items.map((i) => ({
            id: i.id,
            kind: i.kind,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erro ao enviar pedido.");
        setSubmitting(false);
        return;
      }
      // Guarda dados do pedido na sessionStorage pra exibir na página de sucesso
      try {
        sessionStorage.setItem(
          "casaroxa.lastOrder.v1",
          JSON.stringify({
            saleNumber: data.saleNumber,
            total: data.total,
            whatsappLink: data.whatsappLink,
          }),
        );
        sessionStorage.removeItem("casaroxa.checkout.v1");
      } catch {
        /* ignora */
      }
      // Limpa o carrinho via contexto — atualiza o estado E o localStorage.
      // (Apenas remover do localStorage não bastava: o useEffect persist do
      // CartProvider re-escreveria o cart antigo em renders subsequentes.)
      clear();
      try {
        localStorage.removeItem("casaroxa.cart.v1");
      } catch {
        /* ignora */
      }
      router.push("/checkout/sucesso");
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  // ---------- Render ----------

  if (!hydrated) {
    return <p className="text-sm text-slate-500">Carregando carrinho…</p>;
  }

  if (count === 0) {
    return (
      <div className="rounded-xl border border-dashed border-roxa-200 bg-white p-10 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-roxa-300" />
        <h2 className="mt-3 font-serif text-2xl font-semibold text-roxa-900">
          Seu carrinho está vazio
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Que tal escolher algo no cardápio?
        </p>
        <Link
          href="/cardapio"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-roxa-700 px-5 py-3 text-sm font-semibold text-white hover:bg-roxa-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Ir para o cardápio
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Coluna esquerda: items + form */}
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-xl border border-roxa-100 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-roxa-100 px-5 py-4">
            <h2 className="font-serif text-xl font-semibold text-roxa-900">
              Seu pedido
            </h2>
            <Link
              href="/cardapio"
              className="text-xs font-medium text-roxa-700 hover:underline"
            >
              + Adicionar mais
            </Link>
          </header>
          <ul className="divide-y divide-roxa-50">
            {cart.items.map((it) => {
              const key = cartKeyOf(it);
              const lineTotal = it.price * it.quantity;
              return (
                <li key={key} className="flex items-center gap-3 p-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-roxa-50">
                    {it.imageUrl ? (
                      <Image
                        src={it.imageUrl}
                        alt={it.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-roxa-300">
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-slate-900">{it.name}</p>
                    <p className="text-xs text-slate-500">{fmt(it.price)} cada</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-roxa-200">
                    <button
                      type="button"
                      onClick={() => setQty(key, it.quantity - 1)}
                      className="p-2 text-roxa-700 hover:bg-roxa-50"
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">
                      {it.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(key, it.quantity + 1)}
                      className="p-2 text-roxa-700 hover:bg-roxa-50"
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-20 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {fmt(lineTotal)}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(key)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-serif text-xl font-semibold text-roxa-900">
            Seus dados
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Nome completo" required>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.currentTarget.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                placeholder="João da Silva"
              />
            </Field>
            <Field label="Telefone (com DDD)" required>
              <input
                type="tel"
                required
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.currentTarget.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                placeholder="(11) 99999-9999"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-serif text-xl font-semibold text-roxa-900">
            Como você quer receber?
          </h2>
          <div className="flex flex-wrap gap-3">
            {settings.pickupEnabled && (
              <ModeButton
                label="🛍 Retirar no local"
                active={deliveryMode === "PICKUP"}
                onClick={() => setDeliveryMode("PICKUP")}
              />
            )}
            {settings.deliveryEnabled && (
              <ModeButton
                label="🛵 Delivery"
                active={deliveryMode === "DELIVERY"}
                onClick={() => setDeliveryMode("DELIVERY")}
              />
            )}
          </div>

          {deliveryMode === "DELIVERY" && (
            <div className="space-y-3">
              {settings.deliveryFeeNote && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {settings.deliveryFeeNote}
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Endereço (rua)" required className="md:col-span-2">
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.currentTarget.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                    placeholder="Rua das Flores"
                  />
                </Field>
                <Field label="Número">
                  <input
                    type="text"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.currentTarget.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                    placeholder="123"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Bairro" required>
                  <input
                    type="text"
                    required
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.currentTarget.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                    placeholder="Centro"
                  />
                </Field>
                <Field label="Complemento">
                  <input
                    type="text"
                    value={addressComplement}
                    onChange={(e) => setAddressComplement(e.currentTarget.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                    placeholder="Apto 12"
                  />
                </Field>
              </div>
              <Field label="Ponto de referência">
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.currentTarget.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                  placeholder="Próximo à praça"
                />
              </Field>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-serif text-xl font-semibold text-roxa-900">
            Pagamento e observações
          </h2>
          <Field
            label="Forma de pagamento desejada"
            hint="O pagamento é feito na entrega ou retirada — informamos opções (dinheiro, PIX, cartão)."
          >
            <select
              value={paymentHint}
              onChange={(e) => setPaymentHint(e.currentTarget.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
            >
              <option value="">— sem preferência —</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="Cartão de crédito">Cartão de crédito</option>
              <option value="Cartão de débito">Cartão de débito</option>
            </select>
          </Field>
          <Field label="Observações" hint="Pimenta, retirada de algum item, troco, etc.">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
            />
          </Field>
        </section>
      </div>

      {/* Coluna direita: resumo */}
      <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">
        <div className="rounded-xl border border-roxa-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-roxa-900">Resumo</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="tabular-nums">{fmt(total)}</span>
            </div>
            {deliveryMode === "DELIVERY" && (
              <div className="flex justify-between text-slate-500">
                <span>Taxa de entrega</span>
                <span>a combinar</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{fmt(total)}</span>
            </div>
          </div>

          {belowMinimum && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Pedido mínimo é {fmt(minOrder)}. Faltam{" "}
              <strong>{fmt(minOrder - total)}</strong>.
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Enviando…" : "Confirmar pedido"}
          </button>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
            Após confirmar, você será redirecionado pro WhatsApp com o pedido pronto
            pra enviar à Casa Roxa.
          </p>
        </div>

        <Link
          href="/cardapio"
          className="block text-center text-sm text-slate-500 hover:text-roxa-700"
        >
          ← Voltar ao cardápio
        </Link>
      </aside>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <label className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md border-2 border-roxa-700 bg-roxa-50 px-5 py-3 text-sm font-semibold text-roxa-800"
          : "rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 hover:border-roxa-300"
      }
    >
      {label}
    </button>
  );
}
