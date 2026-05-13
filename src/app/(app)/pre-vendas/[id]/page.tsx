import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  Clock,
  Package,
  CalendarDays,
  ShoppingBag,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesEventForm } from "@/components/sales-events/SalesEventForm";
import { SalesEventActions } from "@/components/sales-events/SalesEventActions";
import { getSalesEventById } from "@/server/services/sales-event.service";
import { prisma } from "@/lib/prisma";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberto",
  CLOSED: "Encerrado",
  CANCELLED: "Cancelado",
};
const STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  DRAFT: "neutral",
  OPEN: "info",
  CLOSED: "warning",
  CANCELLED: "danger",
};

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);

export default async function PreVendaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const [event, products, combos] = await Promise.all([
    getSalesEventById(id),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, salePrice: true },
    }),
    prisma.combo.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, salePrice: true },
    }),
  ]);
  if (!event) notFound();

  const editable =
    event.status !== "CANCELLED" && event._count.sales === 0;

  return (
    <div className="space-y-5">
      <Link
        href="/pre-vendas"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" /> Voltar para pré-vendas
      </Link>

      <PageHeader
        title={event.name}
        description={`${event.products.length} item(ns) · ${event.windows.length} janela(s) · evento em ${fmtDate(event.eventDate)}`}
        actions={
          <Badge tone={STATUS_TONE[event.status]}>
            {STATUS_LABEL[event.status]}
          </Badge>
        }
      />

      <SalesEventActions
        eventId={event.id}
        status={event.status}
        salesCount={event._count.sales}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Período de inscrições
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {fmtDateTime(event.opensAt)}
            </p>
            <p className="text-xs text-slate-500">
              até {fmtDateTime(event.closesAt)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" /> Pedidos vinculados
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-roxa-900">
              {event._count.sales}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Timeout das reservas
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {event.reservationTimeoutMinutes} minutos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de produtos com disponibilidade */}
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-roxa-700" /> Produtos / Combos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {event.products.map((p) => {
              const name = p.product?.name ?? p.combo?.name ?? "Item";
              const remaining = p.quantityLimit - p.reservedQty;
              const tone =
                remaining === 0
                  ? "text-red-700 font-bold"
                  : remaining < p.quantityLimit * 0.3
                    ? "text-amber-700"
                    : "text-green-700";
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="flex-1">{name}</span>
                  <span className={`tabular-nums ${tone}`}>
                    {remaining}/{p.quantityLimit} disponíveis
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Lista de janelas com ocupação */}
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-roxa-700" /> Janelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {event.windows.map((w) => {
              const occupied = w.capacity === 0
                ? "ilimitada"
                : `${w.reservedCount}/${w.capacity}`;
              return (
                <li
                  key={w.id}
                  className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <Badge tone={w.kind === "PICKUP" ? "info" : "warning"}>
                    {w.kind === "PICKUP" ? "Retirada" : "Entrega"}
                  </Badge>
                  <span className="flex-1">
                    <strong>{w.label}</strong>
                    <span className="text-xs text-slate-500">
                      {" "}· {fmtDateTime(w.startsAt)} – {fmtDateTime(w.endsAt)}
                    </span>
                  </span>
                  <span className="tabular-nums text-xs text-slate-700">
                    {occupied}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {editable && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Editar dados
            </h2>
            <SalesEventForm
              mode={{ type: "edit", id: event.id }}
              defaultValues={{
                name: event.name,
                eventDate: event.eventDate,
                description: event.description,
                opensAt: event.opensAt,
                closesAt: event.closesAt,
                reservationTimeoutMinutes: event.reservationTimeoutMinutes,
                products: event.products.map((p) => ({
                  productId: p.productId,
                  comboId: p.comboId,
                  quantityLimit: p.quantityLimit,
                  unitPriceCents: p.unitPriceCents,
                  displayOrder: p.displayOrder,
                })),
                windows: event.windows.map((w) => ({
                  kind: w.kind,
                  label: w.label,
                  startsAt: w.startsAt,
                  endsAt: w.endsAt,
                  capacity: w.capacity,
                  displayOrder: w.displayOrder,
                })),
                status: event.status,
              }}
              catalog={{
                products: products.map((p) => ({
                  id: p.id,
                  name: p.name,
                  salePrice: Number(p.salePrice ?? 0),
                })),
                combos: combos.map((c) => ({
                  id: c.id,
                  name: c.name,
                  salePrice: Number(c.salePrice ?? 0),
                })),
              }}
            />
          </CardContent>
        </Card>
      )}

      {event._count.sales > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Pré-venda com pedidos vinculados — edição bloqueada. Cancele e crie nova se precisar mudar.
        </p>
      )}
    </div>
  );
}
