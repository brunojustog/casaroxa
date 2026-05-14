import Link from "next/link";
import { redirect } from "next/navigation";
import { Star, MessageSquare, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import { listReviews, getNpsScore } from "@/server/services/nps.service";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  PROMOTER: "Promotor",
  PASSIVE: "Passivo",
  DETRACTOR: "Detrator",
};
const CATEGORY_TONE: Record<
  string,
  "success" | "warning" | "danger"
> = {
  PROMOTER: "success",
  PASSIVE: "warning",
  DETRACTOR: "danger",
};

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export default async function AvaliacoesPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [reviews, stats] = await Promise.all([
    listReviews({ category: "all" }),
    getNpsScore(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Avaliações (NPS)"
        description="Feedback pós-entrega. Cada nota vira ação: detratores pra recuperar, promotores pra premiar e pedir indicação."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <Star className="h-3 w-3" /> NPS
            </p>
            <p
              className={
                stats.nps >= 50
                  ? "mt-1 text-2xl font-bold tabular-nums text-green-700"
                  : stats.nps >= 0
                    ? "mt-1 text-2xl font-bold tabular-nums text-amber-700"
                    : "mt-1 text-2xl font-bold tabular-nums text-red-700"
              }
            >
              {stats.nps}
            </p>
            <p className="text-[10px] text-slate-500">
              {stats.totalReviews} avaliação(ões)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-600" /> Promotores
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-green-700">
              {stats.promoters}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-amber-600" /> Passivos
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
              {stats.passives}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-600" /> Detratores
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-red-700">
              {stats.detractors}
            </p>
          </CardContent>
        </Card>
      </div>

      {reviews.length === 0 ? (
        <EmptyState>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Star className="h-8 w-8 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-900">
                Nenhuma avaliação ainda
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Marque uma venda como entregue e clique &ldquo;Enviar
                avaliação&rdquo; — quando o cliente responder, aparece aqui.
              </p>
            </div>
          </div>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Cliente</TH>
              <TH className="text-center">Nota</TH>
              <TH>Categoria</TH>
              <TH>Comentário</TH>
              <TH>Cupom resposta</TH>
              <TH>Quando</TH>
            </TR>
          </THead>
          <TBody>
            {reviews.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-slate-900">
                  <Link
                    href={`/avaliacoes/${r.id}`}
                    className="hover:text-roxa-700"
                  >
                    {r.customerName}
                  </Link>
                  {r.sale && (
                    <p className="text-xs text-slate-500">
                      Pedido #{r.sale.number}
                    </p>
                  )}
                </TD>
                <TD className="text-center">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-roxa-100 text-roxa-800 text-sm font-bold tabular-nums">
                    {r.score}
                  </span>
                </TD>
                <TD>
                  <Badge tone={CATEGORY_TONE[r.category]}>
                    {CATEGORY_LABEL[r.category]}
                  </Badge>
                </TD>
                <TD className="text-xs text-slate-600 max-w-xs">
                  {r.comment ? (
                    <span className="line-clamp-2">{r.comment}</span>
                  ) : (
                    <span className="text-slate-400 italic">sem comentário</span>
                  )}
                </TD>
                <TD className="text-xs">
                  {r.followupCoupon ? (
                    <span className="font-mono text-roxa-700">
                      {r.followupCoupon.code}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TD>
                <TD className="text-xs text-slate-600">
                  {fmtDateTime(r.createdAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
