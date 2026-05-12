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
  QrCode,
  RefreshCw,
  Trophy,
} from "lucide-react";

type Method = "PIX" | "CREDIT_CARD";

type Subject =
  | { kind: "sale"; saleId: string; initialMethod: Method }
  | { kind: "raffle"; raffleId: string; raffleName: string };

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
  | { ok: false; error: string; code?: "NEED_CPF" };

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
      raffleNumber: number | null;
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
  const [raffleNumber, setRaffleNumber] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupRef = useRef<Window | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const openCardPopup = useCallback((url: string) => {
    setPopupBlocked(false);
    const w = 480;
    const h = 720;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    const win = window.open(
      url,
      "asaas_checkout",
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );
    if (!win) {
      setPopupBlocked(true);
      return;
    }
    popupRef.current = win;
    setPopupOpen(true);
    win.focus();
  }, []);

  useEffect(() => {
    if (!popupOpen) return;
    const t = setInterval(() => {
      if (popupRef.current?.closed) {
        setPopupOpen(false);
        popupRef.current = null;
      }
    }, 800);
    return () => clearInterval(t);
  }, [popupOpen]);

  useEffect(() => {
    if (paid && popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
      popupRef.current = null;
      setPopupOpen(false);
    }
  }, [paid]);

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
            body: JSON.stringify(cpfCnpj ? { cpfCnpj } : {}),
          });
        }
        const json = (await res.json()) as InitiateResponse;
        if (!json.ok) {
          if (json.code === "NEED_CPF") {
            setNeedCpf(true);
          } else {
            setError(json.error);
          }
          return;
        }
        setNeedCpf(false);
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
          if (json.raffleNumber) setRaffleNumber(json.raffleNumber);
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
      return (
        <div className="space-y-5">
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <Trophy className="mx-auto h-14 w-14 text-amber-500" />
            <h2 className="mt-3 font-serif text-2xl font-bold text-green-900">
              Você está no sorteio!
            </h2>
            {raffleNumber && (
              <p className="mt-3 text-sm text-green-800">
                Seu número da sorte:
              </p>
            )}
            {raffleNumber && (
              <p className="mt-1 font-serif text-5xl font-bold text-roxa-900">
                {raffleNumber}
              </p>
            )}
            <p className="mt-3 text-sm text-green-800">
              Boa sorte! Vamos avisar pelo WhatsApp na hora do sorteio.
            </p>
          </div>
          <Link
            href={`/sorteio/${subject.raffleId}`}
            className="flex items-center justify-center gap-2 rounded-md bg-roxa-700 px-6 py-3 text-base font-semibold text-white hover:bg-roxa-800"
          >
            Voltar pro sorteio <ArrowRight className="h-4 w-4" />
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

      {!loading && needCpf && (
        <CpfForm onSubmit={(cpf) => initiate(method, cpf)} />
      )}

      {!loading && !needCpf && error && (
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

      {!loading && !needCpf && !error && data && method === "PIX" && (
        <PixBlock data={data} copyPix={copyPix} copied={copied} />
      )}

      {!loading && !needCpf && !error && data && method === "CREDIT_CARD" && (
        <CardBlock
          data={data}
          popupOpen={popupOpen}
          popupBlocked={popupBlocked}
          onOpen={() => data.invoiceUrl && openCardPopup(data.invoiceUrl)}
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
        Pra emitir a cobrança no PIX, o banco exige o CPF (ou CNPJ) do pagador.
        É usado só pra essa cobrança e fica salvo no seu cadastro.
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

function CardBlock({
  data,
  popupOpen,
  popupBlocked,
  onOpen,
}: {
  data: Extract<InitiateResponse, { ok: true }>;
  popupOpen: boolean;
  popupBlocked: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-roxa-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-roxa-700" />
        <h2 className="font-serif text-lg font-semibold text-roxa-900">
          Pagar com cartão
        </h2>
      </div>
      <p className="text-sm text-slate-700">
        O cartão é processado em uma janela segura do Asaas — abre aqui mesmo
        sobre essa página, sem sair do site da Casa Roxa.
      </p>

      {!data.invoiceUrl && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Link do checkout indisponível. Tente trocar pra PIX ou recarregar.
        </p>
      )}

      {data.invoiceUrl && !popupOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-roxa-700 px-4 py-3 text-base font-semibold text-white hover:bg-roxa-800"
        >
          <CreditCard className="h-5 w-5" />
          Abrir checkout seguro
        </button>
      )}

      {data.invoiceUrl && popupOpen && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          <div className="flex-1">
            <p className="font-medium">Janela do checkout aberta</p>
            <p className="mt-0.5 text-xs">
              Conclua o pagamento na janelinha. Esta tela vai atualizar sozinha
              quando o cartão for autorizado.
            </p>
            <button
              type="button"
              onClick={onOpen}
              className="mt-2 text-xs font-medium text-blue-800 underline hover:text-blue-900"
            >
              Reabrir janela
            </button>
          </div>
        </div>
      )}

      {data.invoiceUrl && popupBlocked && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">Janela bloqueada pelo navegador</p>
          <p className="text-xs">
            Permita pop-ups deste site, ou abra o checkout em outra aba:
          </p>
          <a
            href={data.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Abrir em nova aba <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
