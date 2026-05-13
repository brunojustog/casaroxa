import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { listSalesEvents } from "@/server/services/sales-event.service";
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

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);

export default async function PreVendasPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const events = await listSalesEvents({ status: "all" });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pré-vendas"
        description="Eventos de venda planejada com lote fechado. Cardápio especial pra fim de semana, datas comemorativas, etc."
        actions={
          <Link
            href="/pre-vendas/nova"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-roxa-700 px-3 text-sm font-semibold text-white hover:bg-roxa-800"
          >
            <Plus className="h-3.5 w-3.5" /> Nova pré-venda
          </Link>
        }
      />

      {events.length === 0 ? (
        <EmptyState>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CalendarDays className="h-8 w-8 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-900">
                Nenhuma pré-venda criada
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Use pré-venda pra produção planejada: cliente reserva durante a
                semana, você produz no fim de semana.
              </p>
            </div>
            <Link
              href="/pre-vendas/nova"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-roxa-700 px-3 text-sm font-semibold text-white hover:bg-roxa-800"
            >
              <Plus className="h-3.5 w-3.5" /> Criar primeira pré-venda
            </Link>
          </div>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nome</TH>
              <TH>Status</TH>
              <TH className="text-center">Pedidos</TH>
              <TH>Data evento</TH>
              <TH>Aberta até</TH>
            </TR>
          </THead>
          <TBody>
            {events.map((e) => (
              <TR key={e.id}>
                <TD className="font-medium text-slate-900">
                  <Link
                    href={`/pre-vendas/${e.id}`}
                    className="hover:text-roxa-700"
                  >
                    {e.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {e._count.products} item(ns) · {e._count.windows} janela(s)
                  </p>
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[e.status]}>
                    {STATUS_LABEL[e.status]}
                  </Badge>
                </TD>
                <TD className="text-center text-slate-700 tabular-nums">
                  {e._count.sales}
                </TD>
                <TD className="text-xs text-slate-600">
                  {fmtDate(e.eventDate)}
                </TD>
                <TD className="text-xs text-slate-600">
                  {fmtDate(e.closesAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

// silenciar não-uso
void Button;
