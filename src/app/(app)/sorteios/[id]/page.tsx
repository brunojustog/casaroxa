import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  Gift,
  Trophy,
  Users,
} from "lucide-react";
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
import { RaffleForm } from "@/components/raffles/RaffleForm";
import { RaffleActions } from "@/components/raffles/RaffleActions";
import { getRaffleById } from "@/server/services/raffle.service";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberto",
  CLOSED: "Encerrado",
  DRAWN: "Sorteado",
  CANCELLED: "Cancelado",
};

const STATUS_TONE: Record<
  string,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  DRAFT: "neutral",
  OPEN: "info",
  CLOSED: "warning",
  DRAWN: "success",
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

const fmtPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return p;
};

export default async function SorteioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const raffle = await getRaffleById(id);
  if (!raffle) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/sorteios"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para sorteios
      </Link>

      <PageHeader
        title={raffle.name}
        description={raffle.prizeDescription ?? "Sem descrição de prêmio"}
        actions={<Badge tone={STATUS_TONE[raffle.status]}>{STATUS_LABEL[raffle.status]}</Badge>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              Inscritos
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-roxa-900">
              {raffle._count.entries}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Período
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {fmtDateTime(raffle.opensAt)}
            </p>
            <p className="text-xs text-slate-500">
              até {fmtDateTime(raffle.closesAt)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              {raffle.status === "DRAWN" ? "Ganhador" : "Sorteio em"}
            </p>
            {raffle.winnerEntry ? (
              <>
                <p className="mt-1 text-sm font-semibold text-amber-700">
                  #{raffle.winnerEntry.number} ·{" "}
                  {raffle.winnerEntry.customer.name}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {fmtPhone(raffle.winnerEntry.customer.phone)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-700">
                {raffle.drawAt ? fmtDateTime(raffle.drawAt) : "Data não definida"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ações de status */}
      <RaffleActions
        raffleId={raffle.id}
        status={raffle.status}
        entryCount={raffle._count.entries}
        totalNumbers={raffle.totalNumbers}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          {/* Lista de inscritos */}
          <Card>
            <CardContent className="p-5">
              <h2 className="text-base font-semibold text-slate-900 inline-flex items-center gap-2 mb-3">
                <Gift className="h-4 w-4 text-roxa-700" />
                Inscritos ({raffle.entries.length})
              </h2>
              {raffle.entries.length === 0 ? (
                <EmptyState>Ninguém entrou ainda. Divulgue pelo WhatsApp/redes sociais.</EmptyState>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH className="text-center w-16">#</TH>
                      <TH>Nome</TH>
                      <TH>Telefone</TH>
                      <TH>Entrou em</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {raffle.entries.map((e) => (
                      <TR
                        key={e.id}
                        className={
                          raffle.winnerEntryId === e.id
                            ? "bg-amber-50/70"
                            : ""
                        }
                      >
                        <TD className="text-center font-mono font-semibold text-amber-700">
                          {raffle.winnerEntryId === e.id ? "🏆 " : ""}#{e.number}
                        </TD>
                        <TD className="font-medium text-slate-900">
                          <Link
                            href={`/clientes/${e.customer.id}`}
                            className="hover:text-roxa-700"
                          >
                            {e.customer.name}
                          </Link>
                        </TD>
                        <TD className="text-xs text-slate-600 tabular-nums">
                          {fmtPhone(e.customer.phone)}
                        </TD>
                        <TD className="text-xs text-slate-500">
                          {fmtDateTime(e.createdAt)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          {/* Edição */}
          {raffle.status !== "DRAWN" && raffle.status !== "CANCELLED" && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">
                  Editar dados
                </h2>
                <RaffleForm
                  mode={{ type: "edit", id: raffle.id }}
                  defaultValues={{
                    name: raffle.name,
                    prizeDescription: raffle.prizeDescription,
                    imageUrl: raffle.imageUrl,
                    opensAt: raffle.opensAt,
                    closesAt: raffle.closesAt,
                    drawAt: raffle.drawAt,
                    ticketPriceCents: raffle.ticketPriceCents,
                    totalNumbers: raffle.totalNumbers,
                    maxTicketsPerCustomer: raffle.maxTicketsPerCustomer,
                    status: raffle.status,
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
