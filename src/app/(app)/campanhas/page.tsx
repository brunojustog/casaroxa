import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Megaphone, Users, BarChart3 } from "lucide-react";
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
import { listCampaigns } from "@/server/services/campaign.service";
import { AUDIENCE_LABEL } from "@/server/services/audience.service";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  DISPATCHING: "Disparando",
  SENT: "Enviada",
  CANCELLED: "Cancelada",
};
const STATUS_TONE: Record<
  string,
  "neutral" | "info" | "warning" | "danger" | "success"
> = {
  DRAFT: "neutral",
  DISPATCHING: "warning",
  SENT: "success",
  CANCELLED: "danger",
};

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export default async function CampanhasPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const campaigns = await listCampaigns({ status: "all" });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Campanhas"
        description="Disparos de marketing pra públicos pré-definidos. Cada campanha tem mensagem, audiência fixa, opcionalmente um cupom — e dispara via WhatsApp."
        actions={
          <Link
            href="/campanhas/nova"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-roxa-700 px-3 text-sm font-semibold text-white hover:bg-roxa-800"
          >
            <Plus className="h-3.5 w-3.5" /> Nova campanha
          </Link>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Megaphone className="h-8 w-8 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-900">
                Nenhuma campanha ainda
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Crie uma pra disparar mensagem pra aniversariantes, inativos
                ou outros públicos fixos.
              </p>
            </div>
            <Link
              href="/campanhas/nova"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-roxa-700 px-3 text-sm font-semibold text-white hover:bg-roxa-800"
            >
              <Plus className="h-3.5 w-3.5" /> Criar primeira campanha
            </Link>
          </div>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nome</TH>
              <TH>Status</TH>
              <TH>Audiência</TH>
              <TH>Cupom</TH>
              <TH className="text-center">
                <Users className="h-3.5 w-3.5 inline" />
              </TH>
              <TH className="text-center">
                <BarChart3 className="h-3.5 w-3.5 inline" />
              </TH>
              <TH>Criada</TH>
            </TR>
          </THead>
          <TBody>
            {campaigns.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium text-slate-900">
                  <Link
                    href={`/campanhas/${c.id}`}
                    className="hover:text-roxa-700"
                  >
                    {c.name}
                  </Link>
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[c.status]}>
                    {STATUS_LABEL[c.status]}
                  </Badge>
                </TD>
                <TD className="text-xs text-slate-700">
                  {AUDIENCE_LABEL[c.audienceKey]}
                </TD>
                <TD className="text-xs">
                  {c.coupon ? (
                    <span className="font-mono text-roxa-700">
                      {c.coupon.code}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TD>
                <TD
                  className="text-center text-slate-700 tabular-nums"
                  title="Envios"
                >
                  {c._count.deliveries}
                </TD>
                <TD
                  className="text-center text-slate-700 tabular-nums"
                  title="Vendas atribuídas"
                >
                  {c._count.attributions}
                </TD>
                <TD className="text-xs text-slate-600">
                  {fmtDateTime(c.createdAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
