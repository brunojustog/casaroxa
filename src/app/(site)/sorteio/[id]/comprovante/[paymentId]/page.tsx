import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Gift,
  Clock,
  Trophy,
  Calendar,
  Receipt,
} from "lucide-react";
import { getRaffleComprovante } from "@/server/services/raffle.service";
import { ComprovanteQrCode } from "@/components/public/raffles/ComprovanteQrCode";

export const dynamic = "force-dynamic";

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);

export default async function ComprovantePage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  const { id, paymentId } = await params;
  const data = await getRaffleComprovante(id, paymentId);
  if (!data) notFound();

  const raffle = data.raffle!;
  const customer = data.customer;
  const numbers = data.raffleEntries.map((e) => e.number);
  const paid = data.status === "RECEIVED" || data.status === "CONFIRMED";
  const isDrawn = raffle.status === "DRAWN";
  const isWinner =
    isDrawn &&
    raffle.winnerEntry &&
    numbers.includes(raffle.winnerEntry.number);

  return (
    <div className="mx-auto max-w-md py-4 space-y-4">
      <header className="rounded-xl border-2 border-roxa-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-roxa-700" />
          <h1 className="font-serif text-lg font-bold text-roxa-900">
            Comprovante de inscrição
          </h1>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Sorteio Casa Roxa · ID #{data.id.slice(-8).toUpperCase()}
        </p>
      </header>

      {/* Status */}
      {paid ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-900">Pagamento confirmado</p>
            {data.paidAt && (
              <p className="text-xs text-green-800">
                Pago em {fmtDateTime(new Date(data.paidAt))}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold text-amber-900">
              Aguardando pagamento
            </p>
            <p className="text-xs text-amber-800">
              Status atual: {data.status}
            </p>
          </div>
        </div>
      )}

      {/* Ganhador */}
      {isWinner && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 text-center">
          <Trophy className="mx-auto h-12 w-12 text-amber-600" />
          <p className="mt-2 font-serif text-xl font-bold text-amber-900">
            🎉 Você ganhou!
          </p>
          <p className="text-sm text-amber-800">
            Número sorteado: <strong>#{raffle.winnerEntry!.number}</strong>
          </p>
        </div>
      )}

      {isDrawn && !isWinner && raffle.winnerEntry && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-sm text-slate-700">
            Sorteio realizado. Número sorteado:{" "}
            <strong className="font-mono">#{raffle.winnerEntry.number}</strong>{" "}
            ({raffle.winnerEntry.customer.name.split(/\s+/)[0]})
          </p>
        </div>
      )}

      {/* Dados do sorteio */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-roxa-700" />
          <h2 className="font-serif font-semibold text-roxa-900">
            {raffle.name}
          </h2>
        </div>
        {raffle.prizeDescription && (
          <p className="text-sm text-slate-700">
            🎁 <strong>Prêmio:</strong> {raffle.prizeDescription}
          </p>
        )}
        {raffle.drawAt && !isDrawn && (
          <p className="text-xs text-slate-600 inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Sorteio em {fmtDate(new Date(raffle.drawAt))}
          </p>
        )}
        {isDrawn && raffle.drawnAt && (
          <p className="text-xs text-slate-600 inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Sorteado em {fmtDate(new Date(raffle.drawnAt))}
          </p>
        )}
      </div>

      {/* Números */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {numbers.length === 1
            ? "Seu número da sorte"
            : `Seus ${numbers.length} números da sorte`}
        </p>
        <div className="flex flex-wrap gap-2">
          {numbers.map((n) => {
            const winner = isWinner && raffle.winnerEntry?.number === n;
            return (
              <span
                key={n}
                className={`inline-flex h-12 min-w-12 items-center justify-center rounded-md px-3 font-mono text-lg font-bold ${
                  winner
                    ? "bg-amber-500 text-white ring-2 ring-amber-700"
                    : "bg-roxa-700 text-white"
                }`}
              >
                {n}
              </span>
            );
          })}
        </div>
      </div>

      {/* Dados da compra */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2 text-sm shadow-sm">
        <Row label="Cliente" value={customer.name} />
        <Row label="Telefone" value={maskPhone(customer.phone)} />
        <Row
          label="Compra"
          value={`${numbers.length} número(s) × ${fmtMoney(
            raffle.ticketPriceCents / 100,
          )}`}
        />
        <Row
          label="Valor pago"
          value={fmtMoney(Number(data.value))}
          strong
        />
        <Row
          label="Data da compra"
          value={fmtDateTime(new Date(data.createdAt))}
        />
        <Row label="ID Asaas" value={data.asaasPaymentId} mono />
      </div>

      {/* QR pra validação */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Verificar autenticidade
        </p>
        <ComprovanteQrCode raffleId={raffle.id} paymentId={data.id} />
        <p className="text-[11px] text-slate-500">
          Escaneie pra abrir este comprovante em outro dispositivo.
        </p>
      </div>

      <div className="text-center">
        <Link
          href={`/sorteio/${raffle.id}`}
          className="text-sm font-medium text-roxa-700 hover:underline"
        >
          ← Voltar ao sorteio
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span
        className={`text-right ${strong ? "font-bold text-roxa-900" : "text-slate-800"} ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function maskPhone(phone: string): string {
  // 5514999999999 → (14) 99999-9999
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}
