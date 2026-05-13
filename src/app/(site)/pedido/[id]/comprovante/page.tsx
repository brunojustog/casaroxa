import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Receipt,
  ShoppingBag,
  Truck,
  MapPin,
} from "lucide-react";
import { getSaleComprovante } from "@/server/services/sales.service";
import { ComprovanteSaleQrCode } from "@/components/public/pedido/ComprovanteSaleQrCode";

export const dynamic = "force-dynamic";

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const PAYMENT_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  APP_IFOOD: "iFood",
  APP_OUTRO: "App",
  OUTRO: "Outro",
};

const PROGRESS_LABEL: Record<string, string> = {
  NOVO: "Recebido",
  CONFIRMADO: "Confirmado",
  PREPARANDO: "Preparando",
  PRONTO: "Pronto",
  SAIU_ENTREGA: "Saiu para entrega",
  ENTREGUE: "Entregue",
};

export default async function ComprovantePedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sale = await getSaleComprovante(id);
  if (!sale) notFound();

  const cliente = sale.customer?.name ?? sale.customerName ?? "Cliente";
  const items = sale.items;
  const subtotal = items.reduce((s, i) => s + Number(i.totalPrice), 0);
  const total = Number(sale.totalRevenue);
  const paid =
    Number(sale.totalPaid) > 0 ||
    sale.onlinePayment?.status === "RECEIVED" ||
    sale.onlinePayment?.status === "CONFIRMED";

  const addr = sale.customer;
  const enderecoCompleto =
    addr?.address
      ? [
          addr.address,
          addr.addressNumber,
          addr.addressComplement,
          addr.neighborhood,
        ]
          .filter(Boolean)
          .join(", ")
      : null;

  return (
    <div className="mx-auto max-w-md py-4 space-y-4">
      <header className="rounded-xl border-2 border-roxa-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-roxa-700" />
          <h1 className="font-serif text-lg font-bold text-roxa-900">
            Comprovante de pedido
          </h1>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Pedido #{sale.number} · {fmtDateTime(new Date(sale.occurredAt))}
        </p>
      </header>

      {/* Status pagamento */}
      {paid ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-900">Pagamento confirmado</p>
            {sale.onlinePayment?.paidAt && (
              <p className="text-xs text-green-800">
                Pago em {fmtDateTime(new Date(sale.onlinePayment.paidAt))}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold text-amber-900">Aguardando pagamento</p>
            <p className="text-xs text-amber-800">
              Combine pelo WhatsApp ou pague online se disponível.
            </p>
          </div>
        </div>
      )}

      {/* Status da entrega */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3 shadow-sm">
        <Truck className="h-7 w-7 text-roxa-700 shrink-0" />
        <div className="flex-1">
          <p className="text-xs text-slate-500">Etapa atual</p>
          <p className="font-semibold text-slate-900">
            {PROGRESS_LABEL[sale.progress] ?? sale.progress}
          </p>
          {sale.progressUpdatedAt && (
            <p className="text-[11px] text-slate-500">
              Atualizado em {fmtDateTime(new Date(sale.progressUpdatedAt))}
            </p>
          )}
        </div>
        <Link
          href={`/pedido/${sale.id}`}
          className="text-xs font-medium text-roxa-700 hover:underline"
        >
          Acompanhar →
        </Link>
      </div>

      {/* Itens */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-roxa-700" />
          <h2 className="font-serif font-semibold text-roxa-900">Itens</h2>
        </div>
        <ul className="space-y-2 divide-y divide-slate-100">
          {items.map((item) => {
            const name = item.product?.name ?? item.combo?.name ?? "Item";
            const qty = Number(item.quantity);
            return (
              <li key={item.id} className="pt-2 first:pt-0 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="flex-1">
                    <strong className="text-slate-900">
                      {qty % 1 === 0 ? qty : qty.toFixed(2)}×
                    </strong>{" "}
                    {name}
                  </span>
                  <span className="font-mono text-slate-700">
                    {fmtMoney(Number(item.totalPrice))}
                  </span>
                </div>
                {item.notes && (
                  <p className="text-[11px] text-slate-500 italic mt-0.5">
                    📝 {item.notes}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Totais */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1.5 text-sm shadow-sm">
        <Row label="Subtotal" value={fmtMoney(subtotal)} />
        {Number(sale.couponDiscount) > 0 && (
          <Row
            label={`Cupom ${sale.couponCode ? `(${sale.couponCode})` : ""}`}
            value={`- ${fmtMoney(Number(sale.couponDiscount))}`}
          />
        )}
        <div className="border-t border-slate-200 pt-1.5 mt-1.5">
          <Row label="Total" value={fmtMoney(total)} strong />
        </div>
        {sale.payments.length > 0 && (
          <div className="border-t border-slate-200 pt-1.5 mt-1.5 space-y-0.5">
            {sale.payments.map((p) => (
              <Row
                key={p.id}
                label={PAYMENT_LABEL[p.method] ?? p.method}
                value={fmtMoney(Number(p.amount))}
                sub
              />
            ))}
          </div>
        )}
        {sale.onlinePayment && (
          <div className="border-t border-slate-200 pt-1.5 mt-1.5">
            <Row
              label={`Online (${sale.onlinePayment.billingType === "PIX" ? "PIX" : "Cartão"})`}
              value={sale.onlinePayment.status}
              sub
            />
            {sale.onlinePayment.asaasPaymentId && (
              <Row
                label="ID transação"
                value={sale.onlinePayment.asaasPaymentId}
                sub
                mono
              />
            )}
          </div>
        )}
      </div>

      {/* Cliente + endereço */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2 text-sm shadow-sm">
        <Row label="Cliente" value={cliente} />
        {sale.customer?.phone && (
          <Row label="Telefone" value={maskPhone(sale.customer.phone)} />
        )}
        {enderecoCompleto && (
          <div className="flex items-start gap-2 pt-1">
            <MapPin className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
            <div className="flex-1 text-xs text-slate-700">
              {enderecoCompleto}
              {sale.customer?.reference && (
                <p className="text-slate-500">📍 {sale.customer.reference}</p>
              )}
            </div>
          </div>
        )}
        {sale.notes && (
          <p className="border-t border-slate-100 pt-2 mt-2 text-xs text-slate-600 italic">
            📝 {sale.notes}
          </p>
        )}
      </div>

      {/* QR pra validação */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Verificar pedido
        </p>
        <ComprovanteSaleQrCode saleId={sale.id} />
        <p className="text-[11px] text-slate-500">
          Escaneie pra abrir o comprovante em outro dispositivo.
        </p>
      </div>

      <div className="text-center">
        <Link
          href="/cardapio"
          className="text-sm font-medium text-roxa-700 hover:underline"
        >
          ← Voltar ao cardápio
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  sub,
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  sub?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span
        className={`${sub ? "text-[11px]" : "text-xs"} uppercase tracking-wider text-slate-500`}
      >
        {label}
      </span>
      <span
        className={`text-right ${strong ? "font-bold text-roxa-900 text-base" : "text-slate-800"} ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}
