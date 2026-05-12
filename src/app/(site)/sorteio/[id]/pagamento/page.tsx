import { notFound, redirect } from "next/navigation";
import { getRaffleForPublic } from "@/server/services/raffle.service";
import { PaymentClient } from "@/components/public/checkout/PaymentClient";

export const dynamic = "force-dynamic";

export default async function RafflePaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const raffle = await getRaffleForPublic(id);
  if (!raffle) notFound();
  if (raffle.ticketPriceCents <= 0) {
    redirect(`/sorteio/${id}`);
  }

  const rawNumbers = typeof sp.numbers === "string" ? sp.numbers : "";
  const numbers = rawNumbers
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= raffle.totalNumbers);

  if (numbers.length === 0) {
    // Sem números selecionados — volta pra grade
    redirect(`/sorteio/${id}`);
  }

  const price = raffle.ticketPriceCents / 100;
  const totalCents = numbers.length * raffle.ticketPriceCents;
  const total = totalCents / 100;

  return (
    <div className="mx-auto max-w-md py-2 space-y-5">
      <header>
        <p className="text-xs uppercase tracking-wider text-slate-500">
          Sorteio · {numbers.length}{" "}
          {numbers.length === 1 ? "número" : "números"}
        </p>
        <h1 className="font-serif text-2xl font-bold text-roxa-900">
          {raffle.name}
        </h1>
        <p className="text-sm text-slate-600">
          Números: <strong className="font-mono">{numbers.sort((a, b) => a - b).join(", ")}</strong>
        </p>
        <p className="text-sm text-slate-600">
          {numbers.length} ×{" "}
          {new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(price)}{" "}
          ={" "}
          <strong>
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(total)}
          </strong>
        </p>
      </header>

      <PaymentClient
        subject={{
          kind: "raffle",
          raffleId: id,
          raffleName: raffle.name,
          numbers,
        }}
      />
    </div>
  );
}
