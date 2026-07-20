"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { trackLead } from "@/lib/analytics-events";
import {
  AlertTriangle,
  ArrowLeft,
  Bus,
  Calendar,
  CalendarClock,
  Clock,
  ImageOff,
  Minus,
  Plus,
  ShoppingBag,
} from "lucide-react";

type EmporioItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  portionLabel: string | null;
  sobEncomenda: boolean;
};

type Trip = {
  id: string;
  tripDate: string; // ISO
  cutoffAt: string; // ISO
  notes: string | null;
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);

const fmtTripDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(iso));

const fmtCutoff = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export function EmporioEncomendaClient({
  catalog,
  trips,
  deliveryEnabled,
  pickupEnabled,
}: {
  catalog: EmporioItem[];
  trips: Trip[];
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
}) {
  const router = useRouter();

  const [tripId, setTripId] = useState(trips[0]?.id ?? "");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const initialMode: "PICKUP" | "DELIVERY" = pickupEnabled
    ? "PICKUP"
    : deliveryEnabled
      ? "DELIVERY"
      : "PICKUP";
  const [deliveryMode, setDeliveryMode] = useState<"PICKUP" | "DELIVERY">(initialMode);
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTrip = trips.find((t) => t.id === tripId) ?? null;

  const cartItems = useMemo(
    () =>
      catalog
        .map((it) => ({ item: it, quantity: qty[it.id] ?? 0 }))
        .filter((x) => x.quantity > 0),
    [catalog, qty],
  );
  const subtotalCents = cartItems.reduce(
    (acc, c) => acc + c.item.priceCents * c.quantity,
    0,
  );
  const count = cartItems.reduce((acc, c) => acc + c.quantity, 0);

  function inc(it: EmporioItem) {
    setQty((cur) => ({ ...cur, [it.id]: (cur[it.id] ?? 0) + 1 }));
  }
  function dec(it: EmporioItem) {
    setQty((cur) => {
      const current = cur[it.id] ?? 0;
      if (current <= 0) return cur;
      if (current === 1) {
        const { [it.id]: _omit, ...rest } = cur;
        void _omit;
        return rest;
      }
      return { ...cur, [it.id]: current - 1 };
    });
  }

  const isDelivery = deliveryMode === "DELIVERY";
  const canSubmit =
    count > 0 &&
    !!selectedTrip &&
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    (!isDelivery || (address.trim().length > 0 && neighborhood.trim().length > 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting || !selectedTrip) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/order-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "EMPORIO",
          supplyTripId: selectedTrip.id,
          requestedFor: selectedTrip.tripDate,
          customerName,
          customerPhone,
          deliveryMode,
          address: isDelivery ? address : undefined,
          addressNumber: isDelivery ? addressNumber : undefined,
          addressComplement: isDelivery ? addressComplement : undefined,
          neighborhood: isDelivery ? neighborhood : undefined,
          reference: isDelivery ? reference : undefined,
          notes,
          items: cartItems.map((c) => ({
            productId: c.item.id,
            comboId: null,
            quantity: c.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erro ao enviar encomenda.");
        setSubmitting(false);
        return;
      }
      trackLead("encomenda_emporio", subtotalCents / 100, data.id);
      router.push(`/encomenda/${data.id}`);
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  const disponiveis = catalog.filter((i) => !i.sobEncomenda);
  const sobEncomenda = catalog.filter((i) => i.sobEncomenda);

  function ItemRow({ it }: { it: EmporioItem }) {
    const current = qty[it.id] ?? 0;
    return (
      <li className="flex items-start gap-3 p-4">
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
          {it.portionLabel && (
            <p className="text-xs text-slate-500">{it.portionLabel}</p>
          )}
          <p className="text-sm font-semibold text-roxa-700">{fmt(it.priceCents)}</p>
        </div>
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
            className="p-2 text-roxa-700 hover:bg-roxa-50"
            aria-label="Aumentar"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Escolha da viagem */}
        <section className="rounded-xl border-2 border-amber-200 bg-amber-50/60 p-5 space-y-3">
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-roxa-900">
            <Bus className="h-5 w-5 text-amber-700" />
            Escolha a viagem
          </h2>
          <p className="text-sm text-slate-700">
            Buscamos a mercadoria em Minas nas datas abaixo. Sua encomenda é
            atendida na volta da viagem escolhida.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {trips.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTripId(t.id)}
                className={
                  t.id === tripId
                    ? "rounded-lg border-2 border-amber-600 bg-white p-3 text-left shadow-sm"
                    : "rounded-lg border border-amber-200 bg-white/70 p-3 text-left hover:border-amber-400"
                }
              >
                <span className="block text-sm font-bold capitalize text-roxa-900">
                  {fmtTripDate(t.tripDate)}
                </span>
                <span className="mt-0.5 block text-xs text-slate-600">
                  Pedidos até {fmtCutoff(t.cutoffAt)}
                </span>
                {t.notes && (
                  <span className="mt-0.5 block text-xs text-amber-800">{t.notes}</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Itens */}
        {disponiveis.length > 0 && (
          <section className="rounded-xl border border-roxa-100 bg-white shadow-sm">
            <header className="border-b border-roxa-100 px-5 py-3">
              <h2 className="font-serif text-lg font-semibold text-roxa-900">
                À pronta entrega
                <span className="ml-2 text-xs font-sans font-normal text-slate-500">
                  também disponíveis na loja
                </span>
              </h2>
            </header>
            <ul className="divide-y divide-roxa-50">
              {disponiveis.map((it) => (
                <ItemRow key={it.id} it={it} />
              ))}
            </ul>
          </section>
        )}

        {sobEncomenda.length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-amber-100 px-5 py-3">
              <CalendarClock className="h-4 w-4 text-amber-700" />
              <h2 className="font-serif text-lg font-semibold text-roxa-900">
                Sob encomenda
                <span className="ml-2 text-xs font-sans font-normal text-slate-500">
                  chegam na viagem escolhida
                </span>
              </h2>
            </header>
            <ul className="divide-y divide-amber-50">
              {sobEncomenda.map((it) => (
                <ItemRow key={it.id} it={it} />
              ))}
            </ul>
          </section>
        )}

        {/* Cliente */}
        <section className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-serif text-xl font-semibold text-roxa-900">Seus dados</h2>
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
          <div className="flex flex-wrap gap-3">
            {pickupEnabled && (
              <ModeButton
                label="🛍 Retirar no local"
                active={deliveryMode === "PICKUP"}
                onClick={() => setDeliveryMode("PICKUP")}
              />
            )}
            {deliveryEnabled && (
              <ModeButton
                label="🛵 Delivery"
                active={deliveryMode === "DELIVERY"}
                onClick={() => setDeliveryMode("DELIVERY")}
              />
            )}
          </div>
          {isDelivery && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-700">Endereço de entrega</p>
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
          <Field label="Observações">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
            />
          </Field>
        </section>
      </div>

      {/* Resumo */}
      <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">
        <div className="rounded-xl border-2 border-amber-300 bg-white p-5 shadow-sm">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <Bus className="h-3 w-3" />
            Empório
          </div>
          <h2 className="mt-2 font-serif text-xl font-semibold text-roxa-900">Resumo</h2>

          {cartItems.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
              Adicione pelo menos um item.
            </p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {cartItems.map((c) => (
                <li key={c.item.id} className="flex justify-between gap-2 text-sm">
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
            <span>Estimativa</span>
            <span className="tabular-nums">{fmt(subtotalCents)}</span>
          </div>

          {selectedTrip && (
            <div className="mt-3 inline-flex w-full items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <Calendar className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Viagem de{" "}
                <strong className="capitalize">{fmtTripDate(selectedTrip.tripDate)}</strong>
                <span className="block text-[11px] mt-0.5">
                  Pedidos até {fmtCutoff(selectedTrip.cutoffAt)} ·{" "}
                  {isDelivery ? "Delivery" : "Retirada no local"} após a volta
                </span>
              </span>
            </div>
          )}

          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>
              Sua encomenda fica <strong>pendente</strong> até a Casa Roxa
              confirmar pelo WhatsApp. Pagamento combinado caso a caso.
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
            <ShoppingBag className="h-4 w-4" />
            {submitting ? "Enviando…" : "Enviar encomenda"}
          </button>
          <p className="mt-2 inline-flex w-full items-center justify-center gap-1 text-center text-[11px] leading-relaxed text-slate-500">
            <Clock className="h-3 w-3" /> Resposta em algumas horas pelo WhatsApp.
          </p>
        </div>

        <Link
          href="/emporio"
          className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-roxa-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao empório
        </Link>
      </aside>
    </form>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
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
