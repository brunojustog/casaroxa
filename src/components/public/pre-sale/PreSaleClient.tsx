"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Clock,
  ImageOff,
  Minus,
  Package,
  Plus,
  ShoppingBag,
} from "lucide-react";

type WindowKind = "PICKUP" | "DELIVERY";

export type PreSaleItem = {
  sepId: string;
  kind: "PRODUTO" | "COMBO";
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  quantityLimit: number | null;
  reservedQty: number;
};

export type PreSaleWindow = {
  id: string;
  kind: WindowKind;
  label: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  reservedCount: number;
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export function PreSaleClient({
  eventId,
  items,
  windows,
  whatsappNumber: _whatsappNumber,
}: {
  eventId: string;
  items: PreSaleItem[];
  windows: PreSaleWindow[];
  whatsappNumber: string | null;
}) {
  void _whatsappNumber;
  const router = useRouter();

  const [qty, setQty] = useState<Record<string, number>>({});
  const [windowId, setWindowId] = useState<string>(() => {
    const firstAvailable = windows.find(
      (w) => w.capacity === null || w.reservedCount < w.capacity,
    );
    return firstAvailable?.id ?? "";
  });
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedWindow = windows.find((w) => w.id === windowId) ?? null;
  const isDelivery = selectedWindow?.kind === "DELIVERY";

  const cartItems = useMemo(
    () =>
      items
        .map((it) => ({ item: it, quantity: qty[it.sepId] ?? 0 }))
        .filter((x) => x.quantity > 0),
    [items, qty],
  );

  const subtotalCents = cartItems.reduce(
    (acc, c) => acc + c.item.priceCents * c.quantity,
    0,
  );
  const count = cartItems.reduce((acc, c) => acc + c.quantity, 0);

  function inc(item: PreSaleItem) {
    setQty((cur) => {
      const current = cur[item.sepId] ?? 0;
      const remaining =
        item.quantityLimit !== null
          ? Math.max(0, item.quantityLimit - item.reservedQty)
          : Infinity;
      if (current >= remaining) return cur;
      return { ...cur, [item.sepId]: current + 1 };
    });
  }

  function dec(item: PreSaleItem) {
    setQty((cur) => {
      const current = cur[item.sepId] ?? 0;
      if (current <= 0) return cur;
      const next = current - 1;
      if (next === 0) {
        const { [item.sepId]: _omit, ...rest } = cur;
        void _omit;
        return rest;
      }
      return { ...cur, [item.sepId]: next };
    });
  }

  const canSubmit =
    count > 0 &&
    !!windowId &&
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    (!isDelivery || (address.trim().length > 0 && neighborhood.trim().length > 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const apiItems = cartItems.map((c) => ({
        id: c.item.id,
        kind: c.item.kind,
        quantity: c.quantity,
      }));
      const res = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          deliveryMode: isDelivery ? "DELIVERY" : "PICKUP",
          address: isDelivery ? address : undefined,
          addressNumber: isDelivery ? addressNumber : undefined,
          addressComplement: isDelivery ? addressComplement : undefined,
          neighborhood: isDelivery ? neighborhood : undefined,
          reference: isDelivery ? reference : undefined,
          notes,
          items: apiItems,
          salesEventId: eventId,
          salesEventWindowId: windowId,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erro ao enviar pedido.");
        setSubmitting(false);
        return;
      }
      router.push(`/pedido/${data.saleId}`);
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Coluna esquerda: produtos + janela + form */}
      <div className="space-y-6 lg:col-span-2">
        {/* Produtos */}
        <section className="rounded-xl border border-roxa-100 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-roxa-100 px-5 py-4">
            <h2 className="font-serif text-xl font-semibold text-roxa-900">
              O que está disponível
            </h2>
            <span className="text-xs text-slate-500">
              {items.length} {items.length === 1 ? "item" : "itens"}
            </span>
          </header>
          <ul className="divide-y divide-roxa-50">
            {items.map((it) => {
              const current = qty[it.sepId] ?? 0;
              const remaining =
                it.quantityLimit !== null
                  ? Math.max(0, it.quantityLimit - it.reservedQty)
                  : null;
              const soldOut = remaining !== null && remaining <= 0;
              const lowStock =
                remaining !== null && remaining > 0 && remaining <= 5;
              return (
                <li key={it.sepId} className="flex items-start gap-3 p-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-roxa-50">
                    {it.imageUrl ? (
                      <Image
                        src={it.imageUrl}
                        alt={it.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-roxa-300">
                        <ImageOff className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-slate-900">{it.name}</p>
                    {it.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {it.description}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-roxa-700">
                      {fmt(it.priceCents)}
                    </p>
                    {remaining !== null && (
                      <p
                        className={
                          soldOut
                            ? "text-[11px] font-semibold text-red-600"
                            : lowStock
                              ? "text-[11px] font-semibold text-amber-700"
                              : "text-[11px] text-slate-500"
                        }
                      >
                        {soldOut
                          ? "Esgotado"
                          : `${remaining} ${remaining === 1 ? "disponível" : "disponíveis"}`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {soldOut ? (
                      <span className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                        Esgotado
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 rounded-md border border-roxa-200">
                        <button
                          type="button"
                          onClick={() => dec(it)}
                          disabled={current === 0}
                          className="p-2 text-roxa-700 hover:bg-roxa-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Diminuir"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">
                          {current}
                        </span>
                        <button
                          type="button"
                          onClick={() => inc(it)}
                          disabled={remaining !== null && current >= remaining}
                          className="p-2 text-roxa-700 hover:bg-roxa-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Seleção de janela */}
        <section className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-roxa-900">
              Quando você quer receber?
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Escolha um horário disponível abaixo.
            </p>
          </div>
          {windows.length === 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Nenhuma janela configurada para esta pré-venda.
            </p>
          ) : (
            <div className="space-y-2">
              {windows.map((w) => {
                const full =
                  w.capacity !== null && w.reservedCount >= w.capacity;
                const remaining =
                  w.capacity !== null
                    ? Math.max(0, w.capacity - w.reservedCount)
                    : null;
                const selected = w.id === windowId;
                return (
                  <label
                    key={w.id}
                    className={
                      full
                        ? "flex cursor-not-allowed items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 opacity-60"
                        : selected
                          ? "flex cursor-pointer items-start gap-3 rounded-md border-2 border-roxa-500 bg-roxa-50/50 p-3"
                          : "flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white p-3 hover:border-roxa-200"
                    }
                  >
                    <input
                      type="radio"
                      name="window"
                      value={w.id}
                      checked={selected}
                      onChange={() => setWindowId(w.id)}
                      disabled={full}
                      className="mt-1 h-4 w-4 accent-roxa-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-roxa-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-roxa-800">
                          {w.kind === "PICKUP" ? (
                            <>
                              <Package className="h-3 w-3" /> Retirada
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="h-3 w-3" /> Delivery
                            </>
                          )}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {w.label}
                        </span>
                      </div>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600">
                        <Clock className="h-3 w-3" />
                        {fmtDateTime(w.startsAt)} — {fmtDateTime(w.endsAt)}
                      </p>
                      {remaining !== null && (
                        <p
                          className={
                            full
                              ? "text-[11px] font-semibold text-red-600 mt-0.5"
                              : remaining <= 3
                                ? "text-[11px] font-semibold text-amber-700 mt-0.5"
                                : "text-[11px] text-slate-500 mt-0.5"
                          }
                        >
                          {full
                            ? "Lotado"
                            : `${remaining} ${remaining === 1 ? "vaga restante" : "vagas restantes"}`}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {/* Dados do cliente */}
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

          {isDelivery && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-700">
                Endereço de entrega
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Endereço (rua)" required className="md:col-span-2">
                  <input
                    type="text"
                    required={isDelivery}
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
                    required={isDelivery}
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
        <div className="rounded-xl border-2 border-roxa-200 bg-white p-5 shadow-sm">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-roxa-700 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <CalendarDays className="h-3 w-3" />
            Pré-venda
          </div>
          <h2 className="mt-2 font-serif text-xl font-semibold text-roxa-900">
            Resumo
          </h2>

          {cartItems.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
              Escolha pelo menos um item ao lado.
            </p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {cartItems.map((c) => (
                <li
                  key={c.item.sepId}
                  className="flex justify-between gap-2 text-sm"
                >
                  <span className="text-slate-700">
                    {c.quantity}× {c.item.name}
                  </span>
                  <span className="tabular-nums text-slate-900">
                    {fmt(c.item.priceCents * c.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
            <span>Total</span>
            <span className="tabular-nums">{fmt(subtotalCents)}</span>
          </div>

          {selectedWindow && (
            <div className="mt-3 rounded-md bg-roxa-50 px-3 py-2 text-xs text-roxa-900">
              <p className="font-semibold">
                {selectedWindow.kind === "PICKUP" ? "Retirada" : "Delivery"} ·{" "}
                {selectedWindow.label}
              </p>
              <p className="text-[11px] text-roxa-800">
                {fmtDateTime(selectedWindow.startsAt)} —{" "}
                {fmtDateTime(selectedWindow.endsAt)}
              </p>
            </div>
          )}

          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>
              Sua reserva fica garantida por 30 minutos após confirmar. Depois
              disso, libera pra outros clientes se não for confirmada.
            </p>
          </div>

          {error && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Enviando…" : "Reservar pré-venda"}
          </button>

          <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
            Após reservar, você acompanha o pedido pela página de pedido com
            link enviado pelo WhatsApp.
          </p>
        </div>

        <Link
          href="/cardapio"
          className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-roxa-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao cardápio
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
