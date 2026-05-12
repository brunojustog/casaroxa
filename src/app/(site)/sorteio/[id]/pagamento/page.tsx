import { notFound, redirect } from "next/navigation";
import { getRaffleForPublic } from "@/server/services/raffle.service";
import { PaymentClient } from "@/components/public/checkout/PaymentClient";

export const dynamic = "force-dynamic";

export default async function RafflePaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const raffle = await getRaffleForPublic(id);
  if (!raffle) notFound();
  if (raffle.ticketPriceCents <= 0) {
    // Gratuita não passa por aqui
    redirect(`/sorteio/${id}`);
  }

  const price = raffle.ticketPriceCents / 100;

  return (
    <div className="mx-auto max-w-md py-2 space-y-5">
      <header>
        <p className="text-xs uppercase tracking-wider text-slate-500">
          Sorteio
        </p>
        <h1 className="font-serif text-2xl font-bold text-roxa-900">
          {raffle.name}
        </h1>
        <p className="text-sm text-slate-600">
          Ticket ·{" "}
          <strong>
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(price)}
          </strong>
        </p>
      </header>

      <PaymentClient
        subject={{ kind: "raffle", raffleId: id, raffleName: raffle.name }}
      />
    </div>
  );
}
