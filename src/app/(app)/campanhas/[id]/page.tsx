import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  Megaphone,
  Users,
  BarChart3,
  Send,
  Tag,
  MessageSquare,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignActions } from "@/components/campanhas/CampaignActions";
import { getCampaignWithDeliveries } from "@/server/services/campaign.service";
import { AUDIENCE_LABEL } from "@/server/services/audience.service";
import { listCustomersForAudience } from "@/server/services/audience.service";
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

const DELIVERY_TONE: Record<
  string,
  "neutral" | "info" | "warning" | "danger" | "success"
> = {
  PENDING: "warning",
  SENT: "success",
  FAILED: "danger",
  SKIPPED: "neutral",
};

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const campaign = await getCampaignWithDeliveries(id);
  if (!campaign) notFound();

  // Pra rascunhos, mostra preview atual da audiência (não snapshot)
  let audienceCount = campaign.audienceSnapshot;
  if (campaign.status === "DRAFT") {
    const customers = await listCustomersForAudience(campaign.audienceKey);
    audienceCount = customers.length;
  }

  const totalRevenue = campaign.attributions.reduce(
    (acc, a) =>
      acc + Number(a.sale.totalRevenue) - Number(a.sale.couponDiscount),
    0,
  );

  return (
    <div className="space-y-5">
      <Link
        href="/campanhas"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" /> Voltar para campanhas
      </Link>

      <PageHeader
        title={campaign.name}
        description={`Audiência: ${AUDIENCE_LABEL[campaign.audienceKey]} · criada por ${campaign.createdBy?.name ?? "—"}`}
        actions={<Badge tone={STATUS_TONE[campaign.status]}>{STATUS_LABEL[campaign.status]}</Badge>}
      />

      <CampaignActions
        campaignId={campaign.id}
        status={campaign.status}
        audienceCount={audienceCount}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Users className="h-3 w-3" />}
          label="Audiência"
          value={String(audienceCount)}
          hint={campaign.status === "DRAFT" ? "Atual" : "No disparo"}
        />
        <KpiCard
          icon={<Send className="h-3 w-3" />}
          label="Enviadas"
          value={String(campaign.deliveries.filter((d) => d.status === "SENT").length)}
        />
        <KpiCard
          icon={<BarChart3 className="h-3 w-3" />}
          label="Vendas atribuídas"
          value={String(campaign.attributions.length)}
        />
        <KpiCard
          icon={<Tag className="h-3 w-3" />}
          label="Receita atribuída"
          value={fmtCurrency(totalRevenue)}
        />
      </div>

      {/* Mensagem + Cupom */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-roxa-700" /> Mensagem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">
              {campaign.message}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-roxa-700" /> Cupom
            </CardTitle>
          </CardHeader>
          <CardContent>
            {campaign.coupon ? (
              <div className="space-y-1 text-sm">
                <p className="font-mono text-lg font-bold text-roxa-700">
                  {campaign.coupon.code}
                </p>
                <p className="text-slate-700">
                  {campaign.coupon.type === "PERCENT"
                    ? `${Number(campaign.coupon.value)}% off`
                    : `${fmtCurrency(Number(campaign.coupon.value))} de desconto`}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                Sem cupom — sem atribuição automática.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Envios */}
      {campaign.deliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-roxa-700" /> Envios (
              {campaign.deliveries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {campaign.deliveries.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{d.customer.name}</p>
                    <p className="text-xs text-slate-500">{d.customer.phone}</p>
                    {d.errorMessage && (
                      <p className="text-[11px] text-red-600 mt-0.5">
                        {d.errorMessage}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge tone={DELIVERY_TONE[d.status]}>{d.status}</Badge>
                    {d.sentAt && (
                      <p className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                        {fmtDateTime(d.sentAt)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Atribuições */}
      {campaign.attributions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-roxa-700" /> Vendas atribuídas (
              {campaign.attributions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {campaign.attributions.map((a) => {
                const total =
                  Number(a.sale.totalRevenue) - Number(a.sale.couponDiscount);
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 py-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/vendas/${a.sale.id}`}
                        className="font-medium text-slate-900 hover:text-roxa-700"
                      >
                        Pedido #{a.sale.number}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {a.sale.customerName} · {fmtDateTime(a.sale.occurredAt)}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums text-slate-900">
                      {fmtCurrency(total)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
          {icon} {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-roxa-900">
          {value}
        </p>
        {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
      </CardContent>
    </Card>
  );
}
