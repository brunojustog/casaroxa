"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Loader2, QrCode, Wallet } from "lucide-react";

/**
 * Seção "Sinal" da página /encomenda/[id]: cobre todos os estados.
 *
 * Estados:
 *   1. Sinal pago        → badge verde
 *   2. Já tem charge     → mostra QR + copia-cola inline + polling
 *   3. Sem charge ainda  → form de CPF (gera charge e atualiza estado)
 */
export function DepositPaymentSection({
  orderRequestId,
  depositCents,
  initialPaid,
  initialPixPayload,
  initialPixQrCodeBase64,
  initialInvoiceUrl,
}: {
  orderRequestId: string;
  depositCents: number;
  initialPaid: boolean;
  initialPixPayload: string | null;
  initialPixQrCodeBase64: string | null;
  initialInvoiceUrl: string | null;
}) {
  const [paid, setPaid] = useState(initialPaid);
  const [pixPayload, setPixPayload] = useState<string | null>(initialPixPayload);
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState<string | null>(
    initialPixQrCodeBase64,
  );
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(initialInvoiceUrl);

  const hasCharge = !!pixPayload || !!pixQrCodeBase64 || !!invoiceUrl;

  // Polling — só quando há charge e ainda não pago. Reload da página
  // quando confirmado pra mostrar estado atualizado de toda a tracking.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (paid || !hasCharge) return;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/public/order-request/${orderRequestId}/payment-status`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (data.ok && data.paid) {
          setPaid(true);
          // Recarrega a página pra mostrar status atualizado nas outras seções
          setTimeout(() => window.location.reload(), 1200);
        }
      } catch {
        /* ignora */
      }
    };
    intervalRef.current = setInterval(tick, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderRequestId, paid, hasCharge]);

  if (paid) {
    return (
      <section className="rounded-xl border-2 border-green-200 bg-green-50 p-4 shadow-sm">
        <p className="text-[11px] uppercase tracking-wider text-green-700 inline-flex items-center gap-1">
          <Wallet className="h-3 w-3" /> Sinal
        </p>
        <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          Recebemos seu sinal de {fmt(depositCents)} ✓
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-roxa-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
        <Wallet className="h-3 w-3" /> Sinal
      </p>
      <p className="mt-1 text-sm">
        <strong className="tabular-nums">{fmt(depositCents)}</strong>{" "}
        <span className="text-amber-700 font-semibold">— aguardando pagamento</span>
      </p>

      {hasCharge ? (
        <PixCharge
          pixPayload={pixPayload}
          pixQrCodeBase64={pixQrCodeBase64}
          invoiceUrl={invoiceUrl}
        />
      ) : (
        <RequestForm
          orderRequestId={orderRequestId}
          onCreated={({ pixPayload, pixQrCodeBase64, invoiceUrl }) => {
            setPixPayload(pixPayload);
            setPixQrCodeBase64(pixQrCodeBase64);
            setInvoiceUrl(invoiceUrl);
          }}
        />
      )}
    </section>
  );
}

// ---------------- PIX inline (QR + copia-cola) ----------------

function PixCharge({
  pixPayload,
  pixQrCodeBase64,
  invoiceUrl,
}: {
  pixPayload: string | null;
  pixQrCodeBase64: string | null;
  invoiceUrl: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignora */
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {pixQrCodeBase64 && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <QrCode className="h-3 w-3" /> Escaneie pra pagar
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR é base64 inline, next/image não otimiza data URIs */}
          <img
            src={`data:image/png;base64,${pixQrCodeBase64}`}
            alt="QR Code do PIX"
            className="h-44 w-44"
          />
        </div>
      )}

      {pixPayload && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            ou copie o código (PIX copia-cola)
          </p>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] font-mono break-all text-slate-700 select-all">
            {pixPayload}
          </div>
          <button
            type="button"
            onClick={copy}
            className={
              copied
                ? "inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white"
                : "inline-flex w-full items-center justify-center gap-2 rounded-md bg-roxa-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-roxa-800"
            }
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Código copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar código PIX
              </>
            )}
          </button>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Aguardando confirmação do pagamento…
      </div>

      {invoiceUrl && (
        <p className="text-center text-[11px] text-slate-500">
          Problemas?{" "}
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-roxa-700"
          >
            Abrir página de pagamento
          </a>
        </p>
      )}
    </div>
  );
}

// ---------------- Form de CPF (cria charge) ----------------

function RequestForm({
  orderRequestId,
  onCreated,
}: {
  orderRequestId: string;
  onCreated: (data: {
    pixPayload: string | null;
    pixQrCodeBase64: string | null;
    invoiceUrl: string | null;
  }) => void;
}) {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCpfCnpj = useCallback((raw: string): string => {
    const d = raw.replace(/\D+/g, "").slice(0, 14);
    if (d.length <= 11) {
      return d
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return d
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }, []);

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
        setError(data.error ?? "Não foi possível gerar a cobrança.");
        setSubmitting(false);
        return;
      }
      onCreated({
        pixPayload: data.pixPayload ?? null,
        pixQrCodeBase64: data.pixQrCodeBase64 ?? null,
        invoiceUrl: data.invoiceUrl ?? null,
      });
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <label className="text-xs font-medium text-slate-700">
        Pra gerar o PIX, informe seu CPF ou CNPJ:
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
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando QR Code…
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            Gerar QR Code PIX
          </>
        )}
      </button>
      <p className="text-[11px] text-slate-500">
        O Asaas exige CPF/CNPJ pra processar a cobrança. Seus dados ficam
        seguros e só são usados pra essa transação.
      </p>
    </form>
  );
}

// ---------------- helpers ----------------

const fmt = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
