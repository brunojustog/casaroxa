import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ClipboardList } from "lucide-react";
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
import { listOrderRequests } from "@/server/services/order-request.service";
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

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export default async function EncomendasPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const requests = await listOrderRequests({ status: "all" });
  const pendingCount = requests.filter((r) => r.status === "PENDENTE").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Encomendas"
        description="Pedidos com data/hora futura — cliente liga ou pede pelo site, você aprova e produz no dia."
        actions={
          <Link
            href="/encomendas/nova"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-roxa-700 px-3 text-sm font-semibold text-white hover:bg-roxa-800"
          >
            <Plus className="h-3.5 w-3.5" /> Nova encomenda
          </Link>
        }
      />

      {pendingCount > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <strong>{pendingCount}</strong>{" "}
          {pendingCount === 1 ? "encomenda pendente" : "encomendas pendentes"} aguardando aprovação.
        </div>
      )}

      {requests.length === 0 ? (
        <EmptyState>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <ClipboardList className="h-8 w-8 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-900">
                Nenhuma encomenda registrada
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Encomendas chegam aqui quando o cliente preenche no site ou
                quando você cadastra manualmente.
              </p>
            </div>
            <Link
              href="/encomendas/nova"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-roxa-700 px-3 text-sm font-semibold text-white hover:bg-roxa-800"
            >
              <Plus className="h-3.5 w-3.5" /> Cadastrar primeira encomenda
            </Link>
          </div>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nº</TH>
              <TH>Cliente</TH>
              <TH>Status</TH>
              <TH>Para quando</TH>
              <TH className="text-center">Itens</TH>
              <TH>Origem</TH>
            </TR>
          </THead>
          <TBody>
            {requests.map((r) => (
              <TR key={r.id}>
                <TD className="font-mono text-xs text-slate-700">
                  <Link
                    href={`/encomendas/${r.id}`}
                    className="hover:text-roxa-700"
                  >
                    ER-{r.number}
                  </Link>
                </TD>
                <TD className="font-medium text-slate-900">
                  <Link
                    href={`/encomendas/${r.id}`}
                    className="hover:text-roxa-700"
                  >
                    {r.customerName}
                  </Link>
                  <p className="text-xs text-slate-500">{r.customerPhone}</p>
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[r.status]}>
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </TD>
                <TD className="text-xs text-slate-700 tabular-nums">
                  {fmtDateTime(r.requestedFor)}
                  {r.kind === "EMPORIO" && (
                    <span className="ml-1.5 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                      Empório
                    </span>
                  )}
                  {r.pickupPoint && (
                    <span className="ml-1.5 inline-block rounded-full bg-roxa-100 px-1.5 py-0.5 text-[10px] font-bold text-roxa-800">
                      📍 {r.pickupPoint.name}
                    </span>
                  )}
                </TD>
                <TD className="text-center text-slate-700 tabular-nums">
                  {r._count.items}
                </TD>
                <TD className="text-xs text-slate-500">
                  {r.source === "SITE" ? "Site" : "Admin"}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
