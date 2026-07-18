import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  Phone,
  Calendar,
  MapPin,
  Wallet,
  FileText,
  ShoppingBag,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderRequestActions } from "@/components/order-requests/OrderRequestActions";
import { getOrderRequestById } from "@/server/services/order-request.service";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  EM_PRODUCAO: "Produzindo",
  PRONTA: "Pronta",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
};
const STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "danger" | "success"> = {
  PENDENTE: "warning",
  APROVADA: "info",
  RECUSADA: "danger",
  EM_PRODUCAO: "info",
  PRONTA: "success",
  ENTREGUE: "success",
  CANCELADA: "neutral",
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

export default async function EncomendaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const req = await getOrderRequestById(id);
  if (!req) notFound();

  const itemsTotal = req.items.reduce(
    (acc, it) =>
      acc + Math.round(Number(it.quantity) * Number(it.unitPriceSnapshot) * 100),
    0,
  );

  return (
    <div className="space-y-5">
      <Link
        href="/encomendas"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" /> Voltar para encomendas
      </Link>

      <PageHeader
        title={`Encomenda ER-${req.number}`}
        description={`Criada por ${req.source === "SITE" ? "cliente pelo site" : (req.createdBy?.name ?? "admin")} em ${fmtDateTime(req.createdAt)}`}
        actions={<Badge tone={STATUS_TONE[req.status]}>{STATUS_LABEL[req.status]}</Badge>}
      />

      <OrderRequestActions
        id={req.id}
        status={req.status}
        hasDeposit={!!req.depositRequiredCents && req.depositRequiredCents > 0}
        depositPaid={!!req.depositPaidAt}
      />

      {req.status === "RECUSADA" && req.rejectionReason && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Motivo da recusa:</p>
          <p>{req.rejectionReason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-roxa-700" /> Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium text-slate-900">{req.customerName}</p>
            <p className="text-slate-600">{req.customerPhone}</p>
            {req.customer && (
              <Link
                href={`/clientes/${req.customer.id}`}
                className="inline-block text-xs text-roxa-700 hover:underline mt-1"
              >
                Ver cadastro do cliente →
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Para quando + modalidade */}
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-roxa-700" /> Para quando
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium text-slate-900">
              {fmtDateTime(req.requestedFor)}
            </p>
            {req.kind === "EMPORIO" && (
              <p className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                🚌 Empório — atendida na volta da viagem a Minas
              </p>
            )}
            <p className="text-slate-600">
              {req.deliveryMode === "PICKUP" ? "🛍 Retirada no local" : "🛵 Delivery"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Endereço (se delivery) */}
      {req.deliveryMode === "DELIVERY" && (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-roxa-700" /> Endereço de entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-0.5">
            <p>
              {[
                req.address,
                req.addressNumber ? `nº ${req.addressNumber}` : null,
                req.addressComplement,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
            {req.neighborhood && <p className="text-slate-600">{req.neighborhood}</p>}
            {req.reference && (
              <p className="text-xs text-slate-500">Ref: {req.reference}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4 text-roxa-700" /> Itens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-slate-100">
            {req.items.map((it) => {
              const name = it.product?.name ?? it.combo?.name ?? "Item";
              const qty = Number(it.quantity);
              const unit = Number(it.unitPriceSnapshot);
              const total = qty * unit;
              return (
                <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex-1">
                    {qty}× {name}
                  </span>
                  <span className="tabular-nums text-slate-700">
                    {fmtCurrency(Math.round(total * 100))}
                  </span>
                </li>
              );
            })}
            <li className="flex items-center gap-3 pt-3 text-sm font-semibold">
              <span className="flex-1">Total</span>
              <span className="tabular-nums">{fmtCurrency(itemsTotal)}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Sinal / pagamento */}
      {req.depositRequiredCents && req.depositRequiredCents > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-roxa-700" /> Sinal
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              Valor:{" "}
              <strong className="tabular-nums">
                {fmtCurrency(req.depositRequiredCents)}
              </strong>
            </p>
            <p className="text-slate-600">
              Status:{" "}
              {req.depositPaidAt ? (
                <span className="text-green-700 font-semibold">
                  Pago em {fmtDateTime(req.depositPaidAt)}
                </span>
              ) : (
                <span className="text-amber-700 font-semibold">
                  Aguardando pagamento
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sale vinculada */}
      {req.sale && (
        <Card>
          <CardContent className="p-4 text-sm flex items-center justify-between">
            <span>
              <span className="font-medium text-slate-900">
                Venda vinculada:
              </span>{" "}
              #{req.sale.number} · status {req.sale.status}
            </span>
            <Link
              href={`/vendas/${req.sale.id}`}
              className="text-xs text-roxa-700 hover:underline"
            >
              Abrir venda →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Observações do cliente */}
      {req.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-roxa-700" /> Observações do cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-line text-slate-700">
            {req.notes}
          </CardContent>
        </Card>
      )}

      {/* Notas internas */}
      {req.adminNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-slate-500" /> Observações internas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-line text-slate-600">
            {req.adminNotes}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
