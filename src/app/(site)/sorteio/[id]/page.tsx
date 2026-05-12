import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Gift, Trophy, Users } from "lucide-react";
import { getRaffleForPublic } from "@/server/services/raffle.service";
import { getAuthedCustomer } from "@/server/services/customer-session.service";
import { RaffleEnterCard } from "@/components/public/raffles/RaffleEnterCard";
import { ReferralTracker } from "@/components/public/raffles/ReferralTracker";

export const dynamic = "force-dynamic";

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export default async function PublicRafflePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const raffle = await getRaffleForPublic(id);
  if (!raffle) notFound();

  // O componente da grade busca o estado completo (taken/mine/minePending)
  // via /api/public/raffles/[id]/numbers no client.
  const customer = await getAuthedCustomer();

  const now = new Date();
  const isOpen =
    raffle.status === "OPEN" &&
    raffle.opensAt <= now &&
    raffle.closesAt >= now;
  const isCancelled = raffle.status === "CANCELLED";
  const isDrawn = raffle.status === "DRAWN";

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <ReferralTracker raffleId={raffle.id} />
      <div className="rounded-xl border border-roxa-100 bg-white shadow-sm overflow-hidden">
        {raffle.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={raffle.imageUrl}
            alt={raffle.name}
            className="w-full max-h-72 object-cover"
          />
        )}
        <div className="p-6 space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">
            <Gift className="h-3 w-3" />
            Sorteio Casa Roxa
          </div>
          <h1 className="font-serif text-3xl font-bold text-roxa-900">
            {raffle.name}
          </h1>
          {raffle.prizes.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {raffle.prizes.length === 1
                  ? "Prêmio"
                  : `${raffle.prizes.length} prêmios`}
              </p>
              <ul className="space-y-1">
                {raffle.prizes.map((p) => {
                  const winner = p.winnerEntry;
                  return (
                    <li
                      key={p.id}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800">
                        {p.position}
                      </span>
                      <span className="flex-1">
                        🎁 {p.description}
                        {winner && (
                          <span className="ml-1 text-amber-700 font-medium">
                            — #{winner.number} ·{" "}
                            {winner.customer.name.split(/\s+/)[0]}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                Inscritos
              </p>
              <p className="font-bold tabular-nums text-roxa-900 text-lg">
                {raffle._count.entries}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Inscrições até
              </p>
              <p className="font-medium text-slate-800">
                {fmtDateTime(raffle.closesAt)}
              </p>
            </div>
          </div>

          {raffle.drawAt && !isDrawn && (
            <p className="text-xs text-slate-500">
              ⏰ Sorteio previsto pra <strong>{fmtDateTime(raffle.drawAt)}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Estado: aberto, encerrado, sorteado, cancelado */}
      {isCancelled && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <p className="font-semibold text-red-900">Sorteio cancelado.</p>
        </div>
      )}

      {isDrawn && raffle.prizes.some((p) => p.winnerEntry) && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 space-y-3">
          <div className="text-center">
            <Trophy className="mx-auto h-12 w-12 text-amber-600" />
            <p className="font-serif text-2xl font-bold text-amber-900">
              🎉 Sorteio realizado!
            </p>
          </div>
          <ul className="space-y-1.5">
            {raffle.prizes
              .filter((p) => p.winnerEntry)
              .sort((a, b) => a.position - b.position)
              .map((p) => (
                <li
                  key={p.id}
                  className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-amber-900">
                    {p.position}º lugar
                  </span>
                  <span className="text-amber-800">
                    {" "}— #{p.winnerEntry!.number} ·{" "}
                    {p.winnerEntry!.customer.name.split(/\s+/)[0]}
                  </span>
                  <p className="text-xs text-slate-600">🎁 {p.description}</p>
                </li>
              ))}
          </ul>
          <p className="text-center text-xs text-amber-800">
            Ganhadores notificados pelo WhatsApp.
          </p>
        </div>
      )}

      {isOpen && (
        <RaffleEnterCard
          raffleId={raffle.id}
          raffleName={raffle.name}
          ticketPriceCents={raffle.ticketPriceCents}
          totalNumbers={raffle.totalNumbers}
          maxTicketsPerCustomer={raffle.maxTicketsPerCustomer}
          authenticated={Boolean(customer)}
          customerId={customer?.id ?? null}
          customerName={customer?.name ?? null}
        />
      )}

      {!isOpen && !isDrawn && !isCancelled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-900">
          Inscrições encerradas — aguardando sorteio.
        </div>
      )}

      <div className="text-center">
        <Link
          href="/cardapio"
          className="text-sm font-medium text-roxa-700 hover:underline"
        >
          ← Voltar ao cardápio
        </Link>
      </div>
    </div>
  );
}
