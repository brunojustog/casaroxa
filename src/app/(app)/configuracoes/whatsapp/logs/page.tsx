import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import { listMessageLogs } from "@/server/services/whatsapp.service";
import { auth } from "@/server/auth";
import type { WhatsAppEvent, WhatsAppMessageStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<WhatsAppEvent, string> = {
  ORDER_CONFIRMED: "Pedido confirmado",
  ORDER_READY: "Pedido pronto",
  ORDER_ON_DELIVERY: "Saiu p/ entrega",
  BIRTHDAY_COUPON: "Cupom de aniversário",
  LOYALTY_REDEEM: "Resgate fidelidade",
  OTP: "Código de verificação",
  MANUAL: "Manual",
  TEST: "Teste",
};

const STATUS_TONE: Record<
  WhatsAppMessageStatus,
  "success" | "danger" | "neutral"
> = {
  SENT: "success",
  FAILED: "danger",
  SKIPPED: "neutral",
};

const STATUS_LABEL: Record<WhatsAppMessageStatus, string> = {
  SENT: "Enviado",
  FAILED: "Falhou",
  SKIPPED: "Pulado",
};

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export default async function WhatsappLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const eventFilter =
    typeof params.event === "string" && params.event.length > 0
      ? (params.event as WhatsAppEvent)
      : undefined;
  const statusFilter =
    typeof params.status === "string" && params.status.length > 0
      ? (params.status as WhatsAppMessageStatus)
      : undefined;

  const logs = await listMessageLogs({
    event: eventFilter,
    status: statusFilter,
    limit: 200,
  });

  return (
    <div className="space-y-5">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para configurações
      </Link>

      <PageHeader
        title="Logs de WhatsApp"
        description="Histórico de mensagens enviadas (ou tentativas) via wuzapi. Útil pra debugar quando algo não chega no cliente."
      />

      <form className="flex flex-wrap items-center gap-2" action="/configuracoes/whatsapp/logs">
        <Select name="event" defaultValue={eventFilter ?? ""} className="w-56">
          <option value="">Todos os eventos</option>
          {Object.entries(EVENT_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={statusFilter ?? ""} className="w-44">
          <option value="">Todos os status</option>
          <option value="SENT">Enviado</option>
          <option value="FAILED">Falhou</option>
          <option value="SKIPPED">Pulado</option>
        </Select>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {logs.length === 0 ? (
        <EmptyState>
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          Nenhuma mensagem enviada ainda.
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Quando</TH>
              <TH>Evento</TH>
              <TH>Telefone</TH>
              <TH>Mensagem</TH>
              <TH>Status</TH>
              <TH>Erro</TH>
            </TR>
          </THead>
          <TBody>
            {logs.map((l) => (
              <TR key={l.id}>
                <TD className="text-xs text-slate-600 whitespace-nowrap">
                  {fmtDateTime(l.createdAt)}
                </TD>
                <TD className="text-xs">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                    {EVENT_LABEL[l.event]}
                  </span>
                </TD>
                <TD className="font-mono text-xs text-slate-700">{l.phone}</TD>
                <TD className="text-xs text-slate-600 max-w-md truncate" title={l.message}>
                  {l.message}
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                </TD>
                <TD className="text-xs text-red-600 max-w-xs truncate" title={l.errorMessage ?? ""}>
                  {l.errorMessage ?? "—"}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {logs.length} registro{logs.length === 1 ? "" : "s"} (últimos 200)
      </div>
    </div>
  );
}
