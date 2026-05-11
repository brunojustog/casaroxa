import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift, Plus } from "lucide-react";
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
import { listRaffles } from "@/server/services/raffle.service";
import { raffleListFiltersSchema } from "@/schemas/raffle.schema";
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

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);

export default async function SorteiosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const filters = raffleListFiltersSchema.parse({
    status: typeof params.status === "string" ? params.status : "all",
  });

  const raffles = await listRaffles(filters);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sorteios"
        description="Crie campanhas com prêmio descritivo, cliente identificado pelo WhatsApp entra com 1 clique, você sorteia na data."
        actions={
          <Link
            href="/sorteios/novo"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Novo sorteio
          </Link>
        }
      />

      <form className="flex flex-wrap items-center gap-2" action="/sorteios">
        <Select name="status" defaultValue={filters.status} className="w-44">
          <option value="all">Todos os status</option>
          <option value="DRAFT">Rascunho</option>
          <option value="OPEN">Aberto</option>
          <option value="CLOSED">Encerrado</option>
          <option value="DRAWN">Sorteado</option>
          <option value="CANCELLED">Cancelado</option>
        </Select>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {raffles.length === 0 ? (
        <EmptyState>
          <Gift className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          Nenhum sorteio ainda.{" "}
          <Link href="/sorteios/novo" className="text-roxa-700 hover:underline">
            Criar o primeiro
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Sorteio</TH>
              <TH>Status</TH>
              <TH className="text-center">Inscritos</TH>
              <TH>Período</TH>
              <TH>Sorteio em</TH>
              <TH>Ganhador</TH>
            </TR>
          </THead>
          <TBody>
            {raffles.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-slate-900">
                  <Link
                    href={`/sorteios/${r.id}`}
                    className="hover:text-roxa-700"
                  >
                    {r.name}
                  </Link>
                  {r.prizeDescription && (
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      🎁 {r.prizeDescription}
                    </p>
                  )}
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </TD>
                <TD className="text-center text-slate-700 tabular-nums">
                  {r._count.entries}
                </TD>
                <TD className="text-xs text-slate-600">
                  {fmtDate(r.opensAt)} → {fmtDate(r.closesAt)}
                </TD>
                <TD className="text-xs text-slate-600">
                  {r.drawAt ? fmtDate(r.drawAt) : r.drawnAt ? fmtDate(r.drawnAt) : "—"}
                </TD>
                <TD className="text-xs text-slate-700">
                  {r.winnerEntry ? (
                    <span>
                      <span className="font-mono text-amber-700">#{r.winnerEntry.number}</span>{" "}
                      {r.winnerEntry.customer.name}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
