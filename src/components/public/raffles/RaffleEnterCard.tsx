"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  MessageCircle,
  QrCode,
  Share2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { OtpLoginDialog } from "@/components/public/auth/OtpLoginDialog";
import {
  getCurrentPushEndpoint,
  subscribeCustomerPush,
} from "@/lib/push-client";

type NumbersState = {
  totalNumbers: number;
  taken: number[];
  mine: number[];
  minePending: number[];
};

export function RaffleEnterCard({
  raffleId,
  raffleName,
  ticketPriceCents,
  totalNumbers,
  maxTicketsPerCustomer,
  authenticated,
  customerId,
  customerName,
  appOnly = false,
}: {
  raffleId: string;
  raffleName: string;
  ticketPriceCents: number;
  totalNumbers: number;
  maxTicketsPerCustomer: number | null;
  authenticated: boolean;
  customerId: string | null;
  customerName: string | null;
  appOnly?: boolean;
}) {
  const router = useRouter();
  const [otpOpen, setOtpOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Gate do sorteio exclusivo do app: null = checando; string = endpoint ok.
  const [pushEndpoint, setPushEndpoint] = useState<string | null>(null);
  const [pushChecked, setPushChecked] = useState(!appOnly);
  const [enablingPush, setEnablingPush] = useState(false);

  useEffect(() => {
    if (!appOnly) return;
    getCurrentPushEndpoint().then((ep) => {
      setPushEndpoint(ep);
      setPushChecked(true);
    });
  }, [appOnly]);

  async function enableAppPush() {
    setEnablingPush(true);
    try {
      const ep = await subscribeCustomerPush();
      if (ep) setPushEndpoint(ep);
      else
        setError(
          "Não consegui ativar as notificações. No iPhone, adicione o site à Tela de Início primeiro (Compartilhar → Adicionar à Tela de Início).",
        );
    } finally {
      setEnablingPush(false);
    }
  }
  const [state, setState] = useState<NumbersState | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const isPaid = ticketPriceCents > 0;
  // Asaas exige R$ 5 mínimo. Pra ticket abaixo disso, cliente precisa
  // comprar múltiplos números pra atingir o mínimo.
  const minNumbersForPayment =
    isPaid && ticketPriceCents < 500
      ? Math.ceil(500 / ticketPriceCents)
      : 1;
  const needsMore = isPaid && selected.size < minNumbersForPayment;

  const priceFormatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(ticketPriceCents / 100);

  const totalSelectedFormatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((selected.size * ticketPriceCents) / 100);

  const loadState = useCallback(async () => {
    try {
      const r = await fetch(`/api/public/raffles/${raffleId}/numbers`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (j.ok) {
        setState({
          totalNumbers: j.totalNumbers,
          taken: j.taken,
          mine: j.mine,
          minePending: j.minePending,
        });
        setSelected(new Set());
      }
    } catch {
      /* ignora */
    }
  }, [raffleId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const takenSet = new Set(state?.taken ?? []);
  const mineSet = new Set(state?.mine ?? []);

  const toggle = (n: number) => {
    if (takenSet.has(n)) return;
    const next = new Set(selected);
    if (next.has(n)) {
      next.delete(n);
    } else {
      if (
        maxTicketsPerCustomer !== null &&
        next.size >= maxTicketsPerCustomer
      ) {
        setError(`Limite de ${maxTicketsPerCustomer} número(s) por cliente.`);
        return;
      }
      next.add(n);
      setError(null);
    }
    setSelected(next);
  };

  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Gera link de indicação (só faz sentido se logado + rifa grátis)
  useEffect(() => {
    if (!customerId || isPaid) {
      setShareLink(null);
      return;
    }
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/sorteio/${raffleId}?ref=${customerId}`;
    setShareLink(url);
  }, [customerId, raffleId, isPaid]);

  async function share() {
    if (!shareLink) return;
    const text = `Tô participando do sorteio "${raffleName}" da Casa Roxa! Entra pelo meu link e a gente ganha um número de presente. 🍀`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: raffleName, text, url: shareLink });
        return;
      } catch {
        /* user cancelou — cai no fallback de copiar */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${shareLink}`);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      /* */
    }
  }

  async function submit() {
    if (!authenticated) {
      setOtpOpen(true);
      return;
    }
    if (appOnly && !pushEndpoint) {
      setError(
        "Este sorteio é exclusivo do app — ative as notificações acima pra participar.",
      );
      return;
    }
    if (selected.size === 0) {
      setError("Escolha pelo menos 1 número.");
      return;
    }
    setError(null);
    const numbers = Array.from(selected);
    if (isPaid) {
      // Vai pra tela de pagamento com a lista selecionada (state via query string)
      const qs = numbers.join(",");
      router.push(`/sorteio/${raffleId}/pagamento?numbers=${qs}`);
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/public/raffles/${raffleId}/enter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numbers,
          pushEndpoint: appOnly ? pushEndpoint : undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.needsAuth) {
          setOtpOpen(true);
          return;
        }
        setError(data.error ?? "Não foi possível entrar.");
        return;
      }
      await loadState();
      router.refresh();
    });
  }

  if (!state) {
    return (
      <div className="rounded-xl border border-roxa-100 bg-white p-6 text-center text-sm text-slate-500">
        Carregando grade…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-roxa-200 bg-roxa-50/50 p-5 space-y-4">
      {appOnly && pushChecked && (
        <div
          className={
            pushEndpoint
              ? "rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
              : "rounded-lg border border-roxa-300 bg-white px-4 py-3 text-sm text-roxa-900"
          }
        >
          {pushEndpoint ? (
            <p>
              📲 <strong>App verificado!</strong> Suas notificações estão
              ativas — você pode participar deste sorteio exclusivo.
            </p>
          ) : (
            <div className="space-y-2">
              <p>
                📲 Este sorteio é <strong>exclusivo do app da Casa Roxa</strong>
                . Ative as notificações pra liberar sua participação (é grátis
                e você fica sabendo se ganhou na hora!).
              </p>
              <button
                type="button"
                onClick={enableAppPush}
                disabled={enablingPush}
                className="rounded-md bg-roxa-700 px-4 py-2 text-sm font-semibold text-white hover:bg-roxa-800 disabled:opacity-60"
              >
                {enablingPush ? "Ativando…" : "Ativar notificações e participar"}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-serif text-lg font-semibold text-roxa-900">
          Escolha seus números
        </h3>
        <button
          type="button"
          onClick={loadState}
          className="text-xs text-roxa-700 hover:underline inline-flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" /> atualizar
        </button>
      </div>

      <NumberGrid
        total={totalNumbers}
        taken={takenSet}
        mine={mineSet}
        selected={selected}
        onToggle={toggle}
      />

      <Legend />

      <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
        {selected.size === 0 ? (
          <p className="text-slate-500">
            Nenhum número escolhido. Toque na grade pra selecionar.
          </p>
        ) : (
          <p>
            <strong>{selected.size}</strong>{" "}
            {selected.size === 1 ? "número" : "números"}{" "}
            ({Array.from(selected).sort((a, b) => a - b).join(", ")})
            {isPaid && (
              <>
                {" · "}
                Total: <strong>{totalSelectedFormatted}</strong>
              </>
            )}
          </p>
        )}
      </div>

      {customerName && (
        <p className="text-xs text-slate-600">
          Olá <strong>{customerName.split(/\s+/)[0]}</strong>!
          {isPaid
            ? ` ${priceFormatted} por número, pagamento via PIX.`
            : " Inscrição gratuita."}
        </p>
      )}

      {needsMore && selected.size > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          O banco exige R$ 5,00 mínimo por cobrança. Selecione pelo menos{" "}
          <strong>{minNumbersForPayment} números</strong> pra continuar (você
          selecionou {selected.size}).
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || selected.size === 0 || needsMore}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-5 py-3 text-base font-semibold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
          isPaid ? "bg-roxa-700 hover:bg-roxa-800" : "bg-amber-500 hover:bg-amber-600"
        }`}
      >
        {!authenticated ? (
          <>
            <MessageCircle className="h-5 w-5" />
            Entrar pelo WhatsApp
            {selected.size > 0 ? ` (${selected.size} nº)` : ""}
          </>
        ) : isPaid ? (
          <>
            <QrCode className="h-5 w-5" />
            {pending
              ? "Gerando PIX…"
              : `Pagar ${totalSelectedFormatted} via PIX`}
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            {pending ? "Inscrevendo…" : "Confirmar inscrição"}
          </>
        )}
      </button>

      {state.mine.length > 0 && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
          <CheckCircle2 className="inline h-3 w-3 mr-1" />
          {state.mine.length === state.minePending.length ? (
            <>Seus números pendentes de pagamento: {state.mine.sort((a, b) => a - b).join(", ")}</>
          ) : (
            <>
              Seus números confirmados:{" "}
              <strong>
                {state.mine
                  .filter((n) => !state.minePending.includes(n))
                  .sort((a, b) => a - b)
                  .join(", ")}
              </strong>
              {state.minePending.length > 0 && (
                <>
                  {" "}
                  · Pendentes: {state.minePending.sort((a, b) => a - b).join(", ")}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Compartilhar pra ganhar bônus (só rifa gratuita + autenticado) */}
      {shareLink && state.mine.length > 0 && (
        <div className="rounded-md border-2 border-dashed border-amber-300 bg-amber-50/60 px-3 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-amber-700" />
            <p className="text-sm font-semibold text-amber-900">
              Indique e ganhe outro número
            </p>
          </div>
          <p className="text-xs text-amber-800">
            Compartilhe seu link. Quando um amigo se inscrever no sorteio pelo
            seu link, <strong>você ganha um número extra</strong> automaticamente.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={share}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
            >
              <Share2 className="h-3.5 w-3.5" />
              {shareCopied ? "Link copiado!" : "Compartilhar"}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareLink);
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                } catch {
                  /* */
                }
              }}
              title="Só copiar o link"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <OtpLoginDialog
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        onSuccess={async () => {
          setOtpOpen(false);
          const numbers = Array.from(selected);
          // Pra rifa paga, redireciona direto pra página de pagamento
          // via window.location pra que o SSR enxergue o cookie novo. Pra
          // rifa grátis, faz a chamada de inscrição diretamente (não
          // depende da prop `authenticated`, que ainda é stale aqui).
          if (numbers.length === 0) {
            window.location.reload();
            return;
          }
          if (isPaid) {
            window.location.href = `/sorteio/${raffleId}/pagamento?numbers=${numbers.join(",")}`;
            return;
          }
          try {
            const res = await fetch(`/api/public/raffles/${raffleId}/enter`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ numbers }),
            });
            const data = await res.json();
            if (!data.ok) {
              setError(data.error ?? "Erro ao inscrever.");
              return;
            }
            window.location.reload();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Erro de rede.");
          }
        }}
      />
    </div>
  );
}

function NumberGrid({
  total,
  taken,
  mine,
  selected,
  onToggle,
}: {
  total: number;
  taken: Set<number>;
  mine: Set<number>;
  selected: Set<number>;
  onToggle: (n: number) => void;
}) {
  const numbers = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="grid grid-cols-10 gap-1.5 max-h-96 overflow-y-auto p-1 rounded-md bg-white border border-slate-200">
      {numbers.map((n) => {
        const isTaken = taken.has(n);
        const isMine = mine.has(n);
        const isSel = selected.has(n);
        const cls = isMine
          ? "bg-green-200 text-green-900 cursor-not-allowed"
          : isTaken
            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
            : isSel
              ? "bg-roxa-700 text-white"
              : "bg-white border border-slate-300 text-slate-700 hover:border-roxa-500 hover:bg-roxa-50";
        return (
          <button
            key={n}
            type="button"
            onClick={() => onToggle(n)}
            disabled={isTaken && !isSel}
            className={`aspect-square rounded text-[11px] font-mono font-semibold ${cls}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
      <span className="inline-flex items-center gap-1">
        <span className="h-3 w-3 rounded border border-slate-300 bg-white" />
        Livre
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-3 w-3 rounded bg-roxa-700" />
        Selecionado
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-3 w-3 rounded bg-slate-200" />
        Vendido
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-3 w-3 rounded bg-green-200" />
        Seu
      </span>
    </div>
  );
}
