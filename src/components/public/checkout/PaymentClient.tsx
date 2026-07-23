"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  CreditCard,
  IdCard,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { OtpLoginDialog } from "@/components/public/auth/OtpLoginDialog";

type Method = "PIX" | "CREDIT_CARD";

type Subject =
  | { kind: "sale"; saleId: string; initialMethod: Method }
  | { kind: "raffle"; raffleId: string; raffleName: string; numbers: number[] };

type InitiateResponse =
  | {
      ok: true;
      paymentId: string;
      billingType: Method;
      status:
        | "PENDING"
        | "RECEIVED"
        | "CONFIRMED"
        | "OVERDUE"
        | "REFUNDED"
        | "FAILED"
        | "CANCELLED";
      pixPayload: string | null;
      pixQrCodeBase64: string | null;
      invoiceUrl: string | null;
      value: number;
      dueDate: string;
      raffleEntryId?: string;
    }
  | { ok: false; error: string; code?: "NEED_CPF"; needsAuth?: boolean };

type StatusResponse =
  | {
      ok: true;
      status:
        | "PENDING"
        | "RECEIVED"
        | "CONFIRMED"
        | "OVERDUE"
        | "REFUNDED"
        | "FAILED"
        | "CANCELLED";
      saleStatus: string | null;
      saleNumber: number | null;
      raffleConfirmed: boolean | null;
      paidAt: string | null;
    }
  | { ok: false; error: string };

const POLL_INTERVAL_MS = 4000;

export function PaymentClient({ subject }: { subject: Subject }) {
  const isSale = subject.kind === "sale";
  const [method, setMethod] = useState<Method>(
    isSale ? subject.initialMethod : "PIX",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needCpf, setNeedCpf] = useState(false);
  const [data, setData] = useState<Extract<InitiateResponse, { ok: true }> | null>(
    null,
  );
  const [paid, setPaid] = useState(false);
  const [confirmedPaymentId, setConfirmedPaymentId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);

  const initiate = useCallback(
    async (m: Method, cpfCnpj?: string) => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        let res: Response;
        if (subject.kind === "sale") {
          res = await fetch("/api/public/payments/initiate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              saleId: subject.saleId,
              billingType: m,
              ...(cpfCnpj ? { cpfCnpj } : {}),
            }),
          });
        } else {
          res = await fetch(`/api/public/raffles/${subject.raffleId}/buy-ticket`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              numbers: subject.numbers,
              ...(cpfCnpj ? { cpfCnpj } : {}),
            }),
          });
        }
        const json = (await res.json()) as InitiateResponse;
        if (!json.ok) {
          if (json.needsAuth) {
            setNeedsAuth(true);
            setNeedCpf(false);
            return;
          }
          if (json.code === "NEED_CPF") {
            setNeedCpf(true);
            setNeedsAuth(false);
          } else {
            setNeedCpf(false);
            setNeedsAuth(false);
            setError(json.error);
          }
          return;
        }
        setNeedCpf(false);
        setNeedsAuth(false);
        setData(json);
        if (json.status === "RECEIVED" || json.status === "CONFIRMED") {
          setPaid(true);
        }
      } catch (e) {
        setError("Falha de conexão. Tente novamente.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [subject],
  );

  useEffect(() => {
    void initiate(method);
  }, [method, initiate]);

  useEffect(() => {
    if (paid || !data) return;
    pollTimer.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/public/payments/by-id/${data.paymentId}/status`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as StatusResponse;
        if (!json.ok) return;
        if (
          json.status === "RECEIVED" ||
          json.status === "CONFIRMED" ||
          json.saleStatus === "CONCLUIDA" ||
          json.raffleConfirmed === true
        ) {
          setPaid(true);
          if (data?.paymentId) setConfirmedPaymentId(data.paymentId);
        }
      } catch {
        /* ignora */
      }
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [data, paid]);

  const copyPix = useCallback(async () => {
    if (!data?.pixPayload) return;
    try {
      await navigator.clipboard.writeText(data.pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* */
    }
  }, [data]);

  if (paid) {
    if (subject.kind === "raffle") {
      const sortedNumbers = subject.numbers.slice().sort((a, b) => a - b);
      const comprovanteHref = confirmedPaymentId
        ? `/sorteio/${subject.raffleId}/comprovante/${confirmedPaymentId}`
        : null;
      return (
        <div className="space-y-5">
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <Trophy className="mx-auto h-14 w-14 text-amber-500" />
            <h2 className="mt-3 font-serif text-2xl font-bold text-green-900">
              Você está no sorteio!
            </h2>
            <p className="mt-3 text-sm text-green-800">
              {sortedNumbers.length === 1
                ? "Seu número da sorte:"
                : "Seus números da sorte:"}
            </p>
            <p className="mt-1 font-serif text-3xl font-bold text-roxa-900 break-words">
              {sortedNumbers.join(" · ")}
            </p>
            <p className="mt-3 text-sm text-green-800">
              Boa sorte! Vamos avisar pelo WhatsApp na hora do sorteio.
            </p>
          </div>
          {comprovanteHref && (
            <Link
              href={comprovanteHref}
              className="flex items-center justify-center gap-2 rounded-md bg-roxa-700 px-6 py-3 text-base font-semibold text-white hover:bg-roxa-800"
            >
              Ver comprovante <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <Link
            href={`/sorteio/${subject.raffleId}`}
            className="text-center text-sm text-slate-600 hover:underline block"
          >
            Voltar pro sorteio
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
          <h2 className="mt-3 font-serif text-2xl font-bold text-green-900">
            Pagamento confirmado!
          </h2>
          <p className="mt-2 text-sm text-green-800">
            Recebemos seu pagamento. Já estamos preparando seu pedido.
          </p>
        </div>
        <Link
          href={`/pedido/${subject.saleId}`}
          className="flex items-center justify-center gap-2 rounded-md bg-roxa-700 px-6 py-3 text-base font-semibold text-white hover:bg-roxa-800"
        >
          Acompanhar pedido <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const followLinkHref =
    subject.kind === "sale"
      ? `/pedido/${subject.saleId}`
      : `/sorteio/${subject.raffleId}`;
  const followLinkLabel =
    subject.kind === "sale" ? "acompanhar o pedido" : "ver o sorteio";

  return (
    <div className="space-y-5">
      {isSale && (
        <MethodSwitcher
          current={method}
          onChange={setMethod}
          disabled={loading}
        />
      )}

      {loading && (
        <div className="rounded-xl border border-roxa-100 bg-white p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-roxa-600" />
          <p className="mt-3 text-sm text-slate-600">
            Gerando cobrança no Asaas…
          </p>
        </div>
      )}

      {!loading && needsAuth && (
        <div className="space-y-3 rounded-xl border border-roxa-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            <h2 className="font-serif text-lg font-semibold text-roxa-900">
              Identifique-se pelo WhatsApp
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            Pra finalizar o pagamento, identifique-se com seu telefone via
            WhatsApp. Você recebe um código de 6 dígitos.
          </p>
          <button
            type="button"
            onClick={() => setOtpOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-3 text-base font-semibold text-white hover:bg-green-700"
          >
            <MessageCircle className="h-5 w-5" />
            Entrar pelo WhatsApp
          </button>
        </div>
      )}

      {!loading && needCpf && (
        <CpfForm onSubmit={(cpf) => initiate(method, cpf)} />
      )}

      <OtpLoginDialog
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        onSuccess={() => {
          setOtpOpen(false);
          // Após autenticar, retenta o initiate — agora o cookie está
          // setado e o backend reconhece o cliente.
          setNeedsAuth(false);
          void initiate(method);
        }}
      />

      {!loading && !needCpf && !needsAuth && error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1 space-y-2">
              <p className="text-sm text-amber-900">{error}</p>
              <button
                onClick={() => initiate(method)}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !needCpf && !needsAuth && !error && data && method === "PIX" && (
        <PixBlock data={data} copyPix={copyPix} copied={copied} />
      )}

      {!loading &&
        !needCpf &&
        !needsAuth &&
        !error &&
        data &&
        method === "CREDIT_CARD" &&
        subject.kind === "sale" && (
          <CardTransparentForm
            saleId={subject.saleId}
            value={data.value}
            onPaid={() => {
              setConfirmedPaymentId(data.paymentId);
              setPaid(true);
            }}
          />
        )}

      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Está demorando? Você pode{" "}
        <Link
          href={followLinkHref}
          className="font-medium text-roxa-700 hover:underline"
        >
          {followLinkLabel}
        </Link>
        .
      </div>
    </div>
  );
}

function MethodSwitcher({
  current,
  onChange,
  disabled,
}: {
  current: Method;
  onChange: (m: Method) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
      <button
        type="button"
        onClick={() => onChange("PIX")}
        disabled={disabled || current === "PIX"}
        className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
          current === "PIX"
            ? "bg-white text-roxa-800 shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        } disabled:cursor-not-allowed`}
      >
        <QrCode className="h-4 w-4" /> PIX
      </button>
      <button
        type="button"
        onClick={() => onChange("CREDIT_CARD")}
        disabled={disabled || current === "CREDIT_CARD"}
        className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
          current === "CREDIT_CARD"
            ? "bg-white text-roxa-800 shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        } disabled:cursor-not-allowed`}
      >
        <CreditCard className="h-4 w-4" /> Cartão
      </button>
    </div>
  );
}

function maskCpfCnpj(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function CpfForm({ onSubmit }: { onSubmit: (cpfCnpj: string) => void }) {
  const [value, setValue] = useState("");
  const digits = value.replace(/\D/g, "");
  const valid = digits.length === 11 || digits.length === 14;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(digits);
      }}
      className="space-y-3 rounded-xl border border-roxa-100 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <IdCard className="h-5 w-5 text-roxa-700" />
        <h2 className="font-serif text-lg font-semibold text-roxa-900">
          CPF / CNPJ
        </h2>
      </div>
      <p className="text-sm text-slate-600">
        Pra emitir a cobrança, o banco exige o CPF (ou CNPJ) do pagador. É
        usado só pra essa cobrança e fica salvo no seu cadastro.
      </p>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(maskCpfCnpj(e.target.value))}
        placeholder="000.000.000-00"
        className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
      />
      <button
        type="submit"
        disabled={!valid}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-roxa-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-roxa-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continuar para pagamento <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

function PixBlock({
  data,
  copyPix,
  copied,
}: {
  data: Extract<InitiateResponse, { ok: true }>;
  copyPix: () => void;
  copied: boolean;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-roxa-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <QrCode className="h-5 w-5 text-roxa-700" />
        <h2 className="font-serif text-lg font-semibold text-roxa-900">
          Pagar com PIX
        </h2>
      </div>

      {data.pixQrCodeBase64 ? (
        <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${data.pixQrCodeBase64}`}
            alt="QR Code PIX"
            className="h-56 w-56"
          />
        </div>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          QR ainda não disponível. Use o copia-cola abaixo.
        </p>
      )}

      {data.pixPayload && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Copia e cola
          </p>
          <div className="break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">
            {data.pixPayload}
          </div>
          <button
            onClick={copyPix}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-roxa-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-roxa-800"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copiado!" : "Copiar código PIX"}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Aguardando confirmação… Esta tela atualiza sozinha quando o pagamento
        cair.
      </div>
    </div>
  );
}

// ---------- Cartão transparente ----------

function maskCardNumber(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function maskExpiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Checkout transparente de cartão: os campos ficam no NOSSO site, no nosso
 * visual. Os dados vão criptografados (HTTPS) pro nosso backend, que repassa
 * direto ao Asaas — nada é salvo. Padrão idêntico ao do projeto IRC.
 */
function CardTransparentForm({
  saleId,
  value,
  onPaid,
}: {
  saleId: string;
  value: number;
  onPaid: () => void;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [ccv, setCcv] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const inputCls =
    "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setCardError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/payments/pay-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId,
          card: { holderName, number: cardNumber, expiry, ccv },
          holder: {
            name,
            email,
            cpfCnpj: cpf,
            postalCode: cep,
            addressNumber,
            phone,
          },
        }),
      });
      const json = (await res.json()) as
        | { ok: true; paid: boolean; status: string }
        | { ok: false; error: string };
      if (!json.ok) {
        setCardError(json.error);
        return;
      }
      if (json.paid) {
        onPaid();
      } else {
        setCardError(
          "Pagamento em análise pelo banco. Esta tela atualiza sozinha quando confirmar.",
        );
      }
    } catch {
      setCardError("Falha de conexão. Confira a internet e tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-roxa-100 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-roxa-700" />
        <h2 className="font-serif text-lg font-semibold text-roxa-900">
          Pagar com cartão
        </h2>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            Número do cartão <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            required
            value={cardNumber}
            onChange={(e) => setCardNumber(maskCardNumber(e.currentTarget.value))}
            placeholder="0000 0000 0000 0000"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            Nome impresso no cartão <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            autoComplete="cc-name"
            required
            value={holderName}
            onChange={(e) => setHolderName(e.currentTarget.value.toUpperCase())}
            placeholder="COMO ESTÁ NO CARTÃO"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Validade <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              required
              value={expiry}
              onChange={(e) => setExpiry(maskExpiry(e.currentTarget.value))}
              placeholder="MM/AA"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              CVV <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              required
              value={ccv}
              onChange={(e) =>
                setCcv(e.currentTarget.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="123"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Dados do titular
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                CPF <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={cpf}
                onChange={(e) => setCpf(maskCpfCnpj(e.currentTarget.value))}
                placeholder="000.000.000-00"
                className={inputCls}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              E-mail <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="voce@email.com"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 space-y-1">
              <label className="text-xs font-medium text-slate-700">
                CEP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                required
                value={cep}
                onChange={(e) => setCep(maskCep(e.currentTarget.value))}
                placeholder="00000-000"
                className={inputCls}
              />
            </div>
            <div className="col-span-1 space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Nº <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.currentTarget.value.slice(0, 10))}
                placeholder="123"
                className={inputCls}
              />
            </div>
            <div className="col-span-1 space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Celular <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.currentTarget.value))}
                placeholder="(14) 99999-9999"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </div>

      {cardError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{cardError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-roxa-700 px-4 py-3 text-base font-semibold text-white hover:bg-roxa-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Processando…
          </>
        ) : (
          <>
            <CreditCard className="h-5 w-5" /> Pagar {fmtBRL(value)}
          </>
        )}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-slate-500">
        🔒 Pagamento processado pelo Asaas com antifraude. A Casa Roxa não
        armazena os dados do seu cartão.
      </p>
    </form>
  );
}
