import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Calendar, Gift, Trophy, Users } from "lucide-react";
import { getRaffleForPublic } from "@/server/services/raffle.service";
import { getAuthedCustomer } from "@/server/services/customer-session.service";
import { prisma } from "@/lib/prisma";
import { RaffleEnterCard } from "@/components/public/raffles/RaffleEnterCard";

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

  // Se cliente identificado, busca a entry dele (se já entrou)
  const customer = await getAuthedCustomer();
  const myEntry = customer
    ? await prisma.raffleEntry.findUnique({
        where: {
          raffleId_customerId: { raffleId: id, customerId: customer.id },
        },
        select: { number: true },
      })
    : null;

  const now = new Date();
  const isOpen =
    raffle.status === "OPEN" &&
    raffle.opensAt <= now &&
    raffle.closesAt >= now;
  const isCancelled = raffle.status === "CANCELLED";
  const isDrawn = raffle.status === "DRAWN";

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
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
          {raffle.prizeDescription && (
            <p className="text-base text-slate-700 leading-relaxed">
              🎁 <strong>Prêmio:</strong> {raffle.prizeDescription}
            </p>
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

      {isDrawn && raffle.winnerEntry && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 text-center space-y-2">
          <Trophy className="mx-auto h-12 w-12 text-amber-600" />
          <p className="font-serif text-2xl font-bold text-amber-900">
            🎉 Sorteado!
          </p>
          <p className="text-base text-amber-900">
            Número <strong className="font-mono">#{raffle.winnerEntry.number}</strong>{" "}
            · <strong>{raffle.winnerEntry.customer.name.split(/\s+/)[0]}</strong>
          </p>
          <p className="text-xs text-amber-800">
            Parabéns! O ganhador foi notificado pelo WhatsApp.
          </p>
        </div>
      )}

      {isOpen && (
        <RaffleEnterCard
          raffleId={raffle.id}
          alreadyEntered={Boolean(myEntry)}
          myNumber={myEntry?.number ?? null}
          authenticated={Boolean(customer)}
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
