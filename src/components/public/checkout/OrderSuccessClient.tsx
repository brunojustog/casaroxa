"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  History,
  ListOrdered,
  MessageCircle,
} from "lucide-react";
import { trackPurchase } from "@/lib/analytics-events";

type LastOrder = {
  saleNumber: number;
  saleId?: string;
  total: number;
  whatsappLink: string | null;
  trackingUrl?: string | null;
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function OrderSuccessClient() {
  const [order, setOrder] = useState<LastOrder | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("casaroxa.lastOrder.v1");
      if (raw) {
        const parsed: LastOrder = JSON.parse(raw);
        setOrder(parsed);
        // Purchase — deduplicado por pedido dentro do trackPurchase.
        trackPurchase(
          parsed.saleId ?? `n-${parsed.saleNumber}`,
          parsed.total,
        );
      }
    } catch {
      /* ignora */
    } finally {
      setHydrated(true);
    }
  }, []);

  // Auto-redireciona pro WhatsApp depois de 1.2s pra parecer "fluxo natural"
  useEffect(() => {
    if (!order?.whatsappLink) return;
    const t = setTimeout(() => {
      window.open(order.whatsappLink!, "_blank");
    }, 1200);
    return () => clearTimeout(t);
  }, [order]);

  if (!hydrated) {
    return <p className="text-sm text-slate-500">Carregando…</p>;
  }

  if (!order) {
    return (
      <div className="rounded-xl border border-dashed border-roxa-200 bg-white p-10 text-center">
        <p className="text-sm text-slate-600">
          Não encontramos um pedido recente nesta sessão. Volte ao{" "}
          <Link href="/cardapio" className="text-roxa-700 hover:underline">
            cardápio
          </Link>
          .
        </p>
      </div>
    );
  }

  // Link de tracking interno (relativo) — funciona mesmo sem PUBLIC_DOMAIN configurado.
  const trackingHref = order.saleId
    ? `/pedido/${order.saleId}`
    : order.trackingUrl;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
        <h1 className="mt-3 font-serif text-3xl font-bold text-green-900">
          Pedido recebido!
        </h1>
        <p className="mt-2 text-sm text-green-800">
          Pedido <strong>#{order.saleNumber}</strong> · Total{" "}
          <strong>{fmt(order.total)}</strong>
        </p>
      </div>

      <div className="rounded-xl border border-roxa-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-xl font-semibold text-roxa-900">
          Próximo passo: confirmar pelo WhatsApp
        </h2>
        <p className="text-sm text-slate-700">
          Pra confirmar e combinar pagamento e horário, envie a mensagem que já
          preparamos. Vamos abrir o WhatsApp em uma nova aba — basta clicar em
          <strong> Enviar</strong>.
        </p>
        {order.whatsappLink ? (
          <a
            href={order.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-700"
          >
            <MessageCircle className="h-5 w-5" />
            Abrir WhatsApp com o pedido
          </a>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            WhatsApp ainda não foi configurado. Entre em contato pelo telefone da loja.
          </p>
        )}
        <p className="text-xs text-slate-500">
          Não recebemos pagamento online. Combine com a Casa Roxa por mensagem
          (dinheiro, PIX, cartão na entrega).
        </p>
      </div>

      {trackingHref && (
        <div className="rounded-xl border border-roxa-100 bg-roxa-50/40 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-roxa-100 text-roxa-700">
              <ListOrdered className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-roxa-900">Acompanhe seu pedido</h3>
              <p className="mt-0.5 text-sm text-slate-700">
                Salve o link abaixo pra ver o andamento do pedido em tempo real
                (Recebido → Preparando → Saiu pra entrega).
              </p>
              <Link
                href={trackingHref}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-roxa-700 px-4 py-2 text-sm font-semibold text-white hover:bg-roxa-800"
              >
                Acompanhar pedido <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Atalho pra Meus pedidos — só aparece se sale tem ID (pode buscar lá) */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
            <History className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-900">
              Quer acompanhar todos os seus pedidos no mesmo lugar?
            </p>
            <p className="mt-0.5 text-amber-800">
              Entre em{" "}
              <Link
                href="/meus-pedidos"
                className="font-medium text-amber-900 underline hover:text-amber-950"
              >
                meus-pedidos
              </Link>{" "}
              com seu WhatsApp — verá histórico, cupons disponíveis e pontos de
              fidelidade.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Link
          href="/cardapio"
          className="inline-flex items-center gap-1 text-sm font-medium text-roxa-700 hover:underline"
        >
          Voltar ao cardápio <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
