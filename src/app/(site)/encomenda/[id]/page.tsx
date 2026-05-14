import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Package,
  ShoppingBag,
  Wallet,
  XCircle,
} from "lucide-react";
import { getPublicOrderRequestTracking } from "@/server/services/order-request.service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const req = await getPublicOrderRequestTracking(id);
  if (!req) return { title: "Encomenda não encontrada", robots: { index: false } };
  return {
    title: `Encomenda ER-${req.number}`,
    description: "Acompanhe sua encomenda na Casa Roxa.",
    robots: { index: false, follow: false },
  };
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Aguardando confirmação",
  APROVADA: "Confirmada",
  RECUSADA: "Não foi possível atender",
  EM_PRODUCAO: "Em produção",
  PRONTA: "Pronta",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
};

const STATUS_HINT: Record<string, string> = {
  PENDENTE: "Vamos confirmar pelo WhatsApp em algumas horas.",
  APROVADA: "Recebemos a confirmação e já estamos planejando.",
  RECUSADA: "Confira o motivo abaixo e tente outra data.",
  EM_PRODUCAO: "Sua encomenda já está sendo preparada.",
  PRONTA: "Pode vir buscar (ou estamos a caminho).",
  ENTREGUE: "Esperamos que tenha gostado!",
  CANCELADA: "Esta encomenda foi cancelada.",
};

const fmtCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

function statusTone(status: string): {
  bg: string;
  border: string;
  text: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "PENDENTE":
      return {
        bg: "bg-amber-50",
        border: "border-amber-200",
        text: "text-amber-900",
        icon: <Clock className="h-5 w-5" />,
      };
    case "APROVADA":
    case "EM_PRODUCAO":
      return {
        bg: "bg-blue-50",
        border: "border-blue-200",
        text: "text-blue-900",
        icon: <Package className="h-5 w-5" />,
      };
    case "PRONTA":
    case "ENTREGUE":
      return {
        bg: "bg-green-50",
        border: "border-green-200",
        text: "text-green-900",
        icon: <CheckCircle2 className="h-5 w-5" />,
      };
    case "RECUSADA":
    case "CANCELADA":
      return {
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-900",
        icon: <XCircle className="h-5 w-5" />,
      };
    default:
      return {
        bg: "bg-slate-50",
        border: "border-slate-200",
        text: "text-slate-800",
        icon: <Clock className="h-5 w-5" />,
      };
  }
}

export default async function EncomendaTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const req = await getPublicOrderRequestTracking(id);
  if (!req) notFound();

  const total = req.items.reduce(
    (acc, it) =>
      acc + Math.round(Number(it.quantity) * Number(it.unitPriceSnapshot) * 100),
    0,
  );
  const tone = statusTone(req.status);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-roxa-700 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
          <Package className="h-3 w-3" />
          Encomenda ER-{req.number}
        </div>
        <h1 className="font-serif text-2xl font-bold text-roxa-900">
          Olá, {req.customerName.split(/\s+/)[0]}
        </h1>
        <p className="text-sm text-slate-600">
          Aqui você acompanha o status da sua encomenda.
        </p>
      </header>

      {/* Status card */}
      <section
        className={`rounded-xl border-2 ${tone.border} ${tone.bg} p-5 flex items-start gap-3`}
      >
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone.text}`}>
          {tone.icon}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold uppercase tracking-wider ${tone.text}`}>
            {STATUS_LABEL[req.status]}
          </p>
          <p className="text-sm mt-1 text-slate-700">{STATUS_HINT[req.status]}</p>
          {req.status === "RECUSADA" && req.rejectionReason && (
            <p className="mt-2 rounded-md bg-white border border-red-100 px-3 py-2 text-sm text-red-800">
              {req.rejectionReason}
            </p>
          )}
        </div>
      </section>

      {/* Sale vinculada (se houver) */}
      {req.saleId && (
        <Link
          href={`/pedido/${req.saleId}`}
          className="flex items-center gap-3 rounded-xl border-2 border-roxa-300 bg-white p-4 hover:bg-roxa-50 transition"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-roxa-100 text-roxa-700">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-roxa-900">Acompanhar pedido</p>
            <p className="text-xs text-roxa-700">
              Vendo o andamento (em produção, pronto, etc.)
            </p>
          </div>
          <span className="text-roxa-700 text-xl">→</span>
        </Link>
      )}

      {/* Data + modalidade */}
      <section className="rounded-xl border border-roxa-100 bg-white p-4 shadow-sm">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" /> Para quando
        </p>
        <p className="mt-1 font-semibold text-slate-900">
          {fmtDateTime(req.requestedFor)}
        </p>
        <p className="text-sm text-slate-600">
          {req.deliveryMode === "PICKUP" ? "🛍 Retirada no local" : "🛵 Delivery"}
        </p>
      </section>

      {/* Items */}
      <section className="rounded-xl border border-roxa-100 bg-white shadow-sm">
        <header className="border-b border-roxa-100 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
            <ShoppingBag className="h-3 w-3" /> Itens encomendados
          </p>
        </header>
        <ul className="divide-y divide-slate-50 p-4">
          {req.items.map((it) => {
            const name = it.product?.name ?? it.combo?.name ?? "Item";
            const qty = Number(it.quantity);
            const unit = Number(it.unitPriceSnapshot);
            return (
              <li key={it.id} className="flex justify-between gap-2 py-2 text-sm">
                <span>
                  {qty}× {name}
                </span>
                <span className="tabular-nums text-slate-700">
                  {fmtCurrency(Math.round(qty * unit * 100))}
                </span>
              </li>
            );
          })}
          <li className="flex justify-between gap-2 pt-3 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{fmtCurrency(total)}</span>
          </li>
        </ul>
      </section>

      {/* Sinal */}
      {req.depositRequiredCents && req.depositRequiredCents > 0 && (
        <section className="rounded-xl border border-roxa-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
            <Wallet className="h-3 w-3" /> Sinal
          </p>
          <p className="mt-1 text-sm">
            <strong className="tabular-nums">
              {fmtCurrency(req.depositRequiredCents)}
            </strong>{" "}
            {req.depositPaidAt ? (
              <span className="text-green-700 font-semibold">— pago ✓</span>
            ) : (
              <span className="text-amber-700 font-semibold">— aguardando pagamento</span>
            )}
          </p>
          {!req.depositPaidAt && (
            <p className="mt-1 text-xs text-slate-500">
              Combine com a Casa Roxa pelo WhatsApp como pagar o sinal.
            </p>
          )}
        </section>
      )}

      <Link
        href="/cardapio"
        className="block text-center text-sm text-slate-500 hover:text-roxa-700"
      >
        ← Voltar ao cardápio
      </Link>
    </div>
  );
}
