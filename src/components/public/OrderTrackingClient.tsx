"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bike,
  Check,
  ChefHat,
  CheckCircle2,
  CircleDashed,
  Clock,
  MessageCircle,
  Package,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";
import {
  SALE_PROGRESS_LABEL,
  SALE_PROGRESS_ORDER,
} from "@/lib/enums";
import type { SaleProgress, SaleStatus } from "@prisma/client";

type SaleData = {
  id: string;
  number: number;
  occurredAt: string;
  customerName: string | null;
  status: SaleStatus;
  progress: SaleProgress;
  progressUpdatedAt: string | null;
  progressEstimateMinutes: number | null;
  total: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
};

const PROGRESS_ICONS: Record<SaleProgress, React.ComponentType<{ className?: string }>> = {
  NOVO: CircleDashed,
  CONFIRMADO: Check,
  PREPARANDO: ChefHat,
  PRONTO: Package,
  SAIU_ENTREGA: Bike,
  ENTREGUE: CheckCircle2,
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export function OrderTrackingClient({
  saleId,
  whatsappNumber,
  initialData,
}: {
  saleId: string;
  whatsappNumber: string | null;
  initialData: SaleData;
}) {
  const [sale, setSale] = useState<SaleData>(initialData);
  const [loading, setLoading] = useState(false);

  // Polling pra cliente ver mudanças sem refresh manual.
  useEffect(() => {
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/public/sale/${saleId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled && data.ok && data.sale) setSale(data.sale);
      } catch {
        /* silencioso */
      }
      if (!cancelled) timer = setTimeout(poll, 60_000);
    }

    timer = setTimeout(poll, 60_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [saleId]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/sale/${saleId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok && data.sale) setSale(data.sale);
    } finally {
      setLoading(false);
    }
  }

  const isCancelled = sale.status === "CANCELADA";
  const waMessage = sale.customerName
    ? `Olá, sou ${sale.customerName}. Gostaria de falar sobre o pedido #${sale.number}.`
    : `Olá! Gostaria de falar sobre o pedido #${sale.number}.`;
  const wa = whatsappLink(whatsappNumber, waMessage);

  if (isCancelled) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <XCircle className="mx-auto h-14 w-14 text-red-600" />
          <h1 className="mt-3 font-serif text-3xl font-bold text-red-900">
            Pedido cancelado
          </h1>
          <p className="mt-2 text-sm text-red-800">
            Pedido #{sale.number} ·{" "}
            {sale.cancelledAt ? fmtDateTime(sale.cancelledAt) : "—"}
          </p>
          {sale.cancelReason && (
            <p className="mt-3 text-sm text-red-700">
              Motivo: <em>{sale.cancelReason}</em>
            </p>
          )}
        </div>
        {wa && (
          <div className="text-center">
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
            >
              Falar com a Casa Roxa
            </a>
          </div>
        )}
      </div>
    );
  }

  const currentIndex = SALE_PROGRESS_ORDER.indexOf(sale.progress);

  return (
    <div className="space-y-8">
      {/* Header do pedido */}
      <header className="rounded-xl border border-roxa-100 bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-serif text-3xl font-bold text-roxa-900">
              Pedido #{sale.number}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {sale.customerName ? `${sale.customerName} · ` : ""}
              {fmtDateTime(sale.occurredAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="text-xs font-medium text-roxa-700 hover:underline disabled:opacity-50"
          >
            {loading ? "Atualizando…" : "Atualizar agora"}
          </button>
        </div>
      </header>

      {/* Timeline */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold text-roxa-900">
          Andamento
        </h2>
        <ol className="space-y-3">
          {SALE_PROGRESS_ORDER.map((step, i) => {
            const Icon = PROGRESS_ICONS[step];
            const done = i < currentIndex;
            const current = i === currentIndex;
            return (
              <li
                key={step}
                className={
                  current
                    ? "flex items-start gap-3 rounded-lg border-2 border-roxa-700 bg-roxa-50 p-3"
                    : done
                      ? "flex items-start gap-3 rounded-lg border border-green-200 bg-green-50/40 p-3"
                      : "flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 opacity-60"
                }
              >
                <div
                  className={
                    current
                      ? "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-roxa-700 text-white"
                      : done
                        ? "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green-600 text-white"
                        : "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-500"
                  }
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p
                    className={
                      current
                        ? "font-semibold text-roxa-900"
                        : done
                          ? "font-medium text-slate-700"
                          : "text-slate-500"
                    }
                  >
                    {SALE_PROGRESS_LABEL[step]}
                  </p>
                  {current && sale.progressUpdatedAt && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      Atualizado em {fmtDateTime(sale.progressUpdatedAt)}
                    </p>
                  )}
                  {current && sale.progressEstimateMinutes && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-roxa-100 px-2 py-0.5 text-xs font-medium text-roxa-800">
                      <Clock className="h-3 w-3" />
                      Em até {sale.progressEstimateMinutes} min
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Items */}
      <section className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl font-semibold text-roxa-900">
          Seu pedido
        </h2>
        <ul className="mt-3 divide-y divide-roxa-50">
          {sale.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900">{it.name}</p>
                <p className="text-xs text-slate-500">
                  {it.quantity}× {fmt(it.unitPrice)}
                </p>
              </div>
              <span className="font-semibold tabular-nums text-slate-900">
                {fmt(it.totalPrice)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t border-roxa-100 pt-3 text-base font-bold text-roxa-900">
          <span>Total</span>
          <span className="tabular-nums">{fmt(sale.total)}</span>
        </div>
      </section>

      {/* Aviso */}
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          O status atualiza automaticamente a cada minuto. Pra ficar mais
          tranquilo,{" "}
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
            >
              fale com a Casa Roxa pelo WhatsApp
            </a>
          ) : (
            <span>fale com a Casa Roxa pelo WhatsApp</span>
          )}{" "}
          se precisar.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/cardapio"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-roxa-700 hover:underline"
        >
          <ShoppingBag className="h-4 w-4" />
          Ver cardápio
        </Link>
      </div>

      {/* Botão flutuante de WhatsApp — sticky no rodapé, sempre visível */}
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar com a Casa Roxa pelo WhatsApp"
          className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-xl ring-4 ring-green-600/20 hover:bg-green-700 sm:bottom-6 sm:right-6"
        >
          <MessageCircle className="h-5 w-5" />
          <span>Falar sobre o pedido</span>
        </a>
      )}
    </div>
  );
}
