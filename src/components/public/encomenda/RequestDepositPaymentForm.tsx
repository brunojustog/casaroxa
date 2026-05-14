"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";

/**
 * Formulário pra cliente solicitar link de pagamento do sinal da
 * encomenda. Pede CPF/CNPJ (Asaas exige), chama o endpoint público
 * e redireciona pro invoiceUrl ao receber resposta.
 */
export function RequestDepositPaymentForm({
  orderRequestId,
}: {
  orderRequestId: string;
}) {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mascara enquanto digita: 11 dígitos = CPF, 14 = CNPJ
  function formatCpfCnpj(raw: string): string {
    const d = raw.replace(/\D+/g, "").slice(0, 14);
    if (d.length <= 11) {
      // CPF: 000.000.000-00
      return d
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    // CNPJ: 00.000.000/0000-00
    return d
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/public/order-request/${orderRequestId}/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpfCnpj: cpfCnpj.replace(/\D+/g, "") }),
        },
      );
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Não foi possível gerar o link.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.invoiceUrl;
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <label className="text-xs font-medium text-slate-700">
        Pra gerar o link de pagamento (PIX), informe seu CPF ou CNPJ:
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={cpfCnpj}
        onChange={(e) => setCpfCnpj(formatCpfCnpj(e.currentTarget.value))}
        placeholder="000.000.000-00"
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
        required
        autoComplete="off"
      />
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || cpfCnpj.replace(/\D+/g, "").length < 11}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Wallet className="h-4 w-4" />
        {submitting ? "Gerando link…" : "Gerar link de pagamento (PIX)"}
      </button>
      <p className="text-[11px] text-slate-500">
        O Asaas exige CPF/CNPJ pra processar a cobrança. Seus dados ficam
        seguros e só são usados pra essa transação.
      </p>
    </form>
  );
}
