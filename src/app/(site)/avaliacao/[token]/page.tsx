import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, ShoppingBag } from "lucide-react";
import { getReviewInviteByToken } from "@/server/services/nps.service";
import { ReviewForm } from "@/components/public/avaliacao/ReviewForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Avaliar pedido",
  robots: { index: false, follow: false },
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sale = await getReviewInviteByToken(token);
  if (!sale) notFound();

  const firstName = sale.customerName?.split(/\s+/)[0] ?? "amigo";

  // Se já tem review, mostra mensagem de "obrigado"
  if (sale.review) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-6">
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 text-center space-y-3">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <h1 className="font-serif text-xl font-bold text-green-900">
            Você já avaliou este pedido
          </h1>
          <p className="text-sm text-green-900">
            Sua nota: <strong>{sale.review.score}/10</strong>
          </p>
          <p className="text-xs text-green-800">
            Obrigado pelo feedback, {firstName}!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5 py-6">
      <header className="space-y-1.5">
        <h1 className="font-serif text-2xl font-bold text-roxa-900">
          Como foi seu pedido?
        </h1>
        <p className="text-sm text-slate-600">
          Pedido <strong>#{sale.number}</strong> de {fmtDate(sale.occurredAt)}
        </p>
      </header>

      <section className="rounded-xl border border-roxa-100 bg-white p-4 shadow-sm">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
          <ShoppingBag className="h-3 w-3" /> O que pediu
        </p>
        <ul className="mt-2 space-y-0.5">
          {sale.items.map((it) => (
            <li key={it.id} className="text-sm text-slate-700">
              {Number(it.quantity)}× {it.product?.name ?? it.combo?.name ?? "—"}
            </li>
          ))}
        </ul>
      </section>

      <ReviewForm token={token} customerFirstName={firstName} />
    </div>
  );
}
