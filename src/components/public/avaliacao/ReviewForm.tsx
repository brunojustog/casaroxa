"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send, Star } from "lucide-react";

type Submitted = {
  reviewId: string;
  category: "DETRACTOR" | "PASSIVE" | "PROMOTER";
};

export function ReviewForm({
  token,
  customerFirstName,
}: {
  token: string;
  customerFirstName: string;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Submitted | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (score === null || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/review/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, comment: comment.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erro ao enviar avaliação.");
        setSubmitting(false);
        return;
      }
      setDone({ reviewId: data.reviewId, category: data.category });
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  if (done) {
    const message =
      done.category === "PROMOTER"
        ? `Que demais, ${customerFirstName}! 💜 Obrigado por avaliar. Se quiser indicar alguém pra conhecer a Casa Roxa, é só mandar nosso link no WhatsApp!`
        : done.category === "PASSIVE"
          ? `Obrigado pela avaliação, ${customerFirstName}! Vamos usar isso pra melhorar.`
          : `Obrigado por compartilhar, ${customerFirstName}. Sua opinião é fundamental pra gente corrigir o que não foi bom. Pode esperar contato da Casa Roxa.`;
    return (
      <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 text-center space-y-3">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
        <h2 className="font-serif text-xl font-bold text-green-900">
          Avaliação enviada
        </h2>
        <p className="text-sm text-green-900">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="text-sm font-medium text-slate-800">
          De 0 a 10, qual a chance de você recomendar a Casa Roxa pra alguém?
          <span className="ml-1 text-red-500">*</span>
        </label>
        <p className="mt-1 text-xs text-slate-500">
          0 = nem pensar · 10 = com certeza recomendaria
        </p>
        <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-11">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => {
            const selected = score === n;
            const tone =
              n <= 6
                ? "bg-red-600 hover:bg-red-700"
                : n <= 8
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-green-600 hover:bg-green-700";
            return (
              <button
                type="button"
                key={n}
                onClick={() => setScore(n)}
                className={
                  selected
                    ? `${tone} text-white rounded-md py-3 text-sm font-bold ring-4 ring-offset-2 ring-roxa-300`
                    : "rounded-md border-2 border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:border-roxa-400 hover:text-roxa-700"
                }
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-800">
          Quer deixar um comentário? <span className="text-slate-400">(opcional)</span>
        </label>
        <textarea
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
          placeholder="O que te marcou — bom ou ruim. Curto, longo, do jeito que vier."
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
        />
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={score === null || submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-roxa-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-roxa-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {submitting ? "Enviando…" : "Enviar avaliação"}
      </button>

      <p className="text-center text-[11px] text-slate-500 inline-flex items-center gap-1 w-full justify-center">
        <Star className="h-3 w-3" /> Leva 30 segundos, juramos.
      </p>
    </form>
  );
}
