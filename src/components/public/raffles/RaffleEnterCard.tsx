"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Copy,
  MessageCircle,
  PartyPopper,
  QrCode,
  Share2,
  Smartphone,
  Sparkles,
  RefreshCw,
  Ticket,
  UserRound,
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

/**
 * Assistente guiado de participação no sorteio — um passo por vez:
 *   1. Instalar o app + ativar notificações (só sorteios appOnly)
 *   2. Cadastro rápido (nome + WhatsApp, via OTP)
 *   3. Escolher o número
 * O passo atual é detectado sozinho (quem já tem app/cadastro pula direto).
 */
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
  drawAtLabel = null,
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
  drawAtLabel?: string | null;
}) {
  const router = useRouter();
  const [otpOpen, setOtpOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pushEndpoint, setPushEndpoint] = useState<string | null>(null);
  const [pushChecked, setPushChecked] = useState(!appOnly);
  const [enablingPush, setEnablingPush] = useState(false);
  const [state, setState] = useState<NumbersState | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const isPaid = ticketPriceCents > 0;
  const minNumbersForPayment =
    isPaid && ticketPriceCents < 500 ? Math.ceil(500 / ticketPriceCents) : 1;
  const needsMore = isPaid && selected.size < minNumbersForPayment;

  const priceFormatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(ticketPriceCents / 100);
  const totalSelectedFormatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((selected.size * ticketPriceCents) / 100);

  useEffect(() => {
    if (!appOnly) return;
    getCurrentPushEndpoint().then((ep) => {
      setPushEndpoint(ep);
      setPushChecked(true);
    });
  }, [appOnly]);

  async function enableAppPush() {
    setEnablingPush(true);
    setError(null);
    try {
      const ep = await subscribeCustomerPush();
      if (ep) setPushEndpoint(ep);
      else
        setError(
          "Não consegui ativar as notificações. No iPhone: primeiro adicione o site à Tela de Início (botão Compartilhar → Adicionar à Tela de Início) e abra por lá. No Android/computador: toque em “Instalar app” quando aparecer, ou permita as notificações.",
        );
    } finally {
      setEnablingPush(false);
    }
  }

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

  useEffect(() => {
    if (!customerId || isPaid) {
      setShareLink(null);
      return;
    }
    if (typeof window === "undefined") return;
    setShareLink(`${window.location.origin}/sorteio/${raffleId}?ref=${customerId}`);
  }, [customerId, raffleId, isPaid]);

  async function share() {
    if (!shareLink) return;
    const text = `Tô participando do sorteio "${raffleName}" da Casa Roxa! Entra pelo meu link e a gente ganha um número de presente. 🍀`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: raffleName, text, url: shareLink });
        return;
      } catch {
        /* cai no copiar */
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

  const takenSet = new Set(state?.taken ?? []);
  const mineSet = new Set(state?.mine ?? []);

  const toggle = (n: number) => {
    if (takenSet.has(n)) return;
    const next = new Set(selected);
    if (next.has(n)) {
      next.delete(n);
    } else {
      if (maxTicketsPerCustomer !== null && next.size >= maxTicketsPerCustomer) {
        if (maxTicketsPerCustomer === 1) {
          // 1 número por pessoa: trocar a seleção em vez de dar erro
          next.clear();
          next.add(n);
          setSelected(next);
          setError(null);
          return;
        }
        setError(`Limite de ${maxTicketsPerCustomer} número(s) por cliente.`);
        return;
      }
      next.add(n);
      setError(null);
    }
    setSelected(next);
  };

  function confirmNumbers() {
    if (selected.size === 0) {
      setError("Toque num número da grade pra escolher o seu.");
      return;
    }
    setError(null);
    const numbers = Array.from(selected);
    if (isPaid) {
      router.push(`/sorteio/${raffleId}/pagamento?numbers=${numbers.join(",")}`);
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

  // ---------- estado dos passos ----------
  const steps: { key: string; label: string; icon: typeof Smartphone; done: boolean }[] = [];
  if (appOnly)
    steps.push({ key: "app", label: "Instalar o app", icon: Smartphone, done: !!pushEndpoint });
  steps.push({ key: "cadastro", label: "Cadastro rápido", icon: UserRound, done: authenticated });
  steps.push({
    key: "numero",
    label: "Seu número",
    icon: Ticket,
    done: (state?.mine.length ?? 0) > 0,
  });

  const allDone = steps.every((s) => s.done);
  const current = steps.find((s) => !s.done)?.key ?? "pronto";
  const loading = !state || (appOnly && !pushChecked);

  if (loading) {
    return (
      <div className="rounded-xl border border-roxa-100 bg-white p-6 text-center text-sm text-slate-500">
        Carregando sorteio…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de progresso dos passos */}
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-1.5">
            <div
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 text-center ${
                s.done
                  ? "border-green-300 bg-green-50"
                  : s.key === current
                    ? "border-roxa-400 bg-roxa-50"
                    : "border-slate-200 bg-white opacity-60"
              }`}
            >
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                  s.done
                    ? "bg-green-600 text-white"
                    : s.key === current
                      ? "bg-roxa-700 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {s.done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`text-[11px] font-medium leading-tight ${
                  s.done ? "text-green-800" : s.key === current ? "text-roxa-900" : "text-slate-500"
                }`}
              >
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* PASSO: instalar app + notificações */}
      {current === "app" && (
        <div className="rounded-xl border-2 border-roxa-300 bg-white p-5 space-y-3">
          <h3 className="font-serif text-lg font-bold text-roxa-900">
            Passo 1 — Instale o app e ative as notificações
          </h3>
          <p className="text-sm text-slate-700">
            Este sorteio é <strong>exclusivo pra quem tem o app da Casa Roxa</strong>. É grátis,
            rapidinho, e é pelo app que você fica sabendo <strong>na hora</strong> se ganhou — além
            de receber o link dos próximos sorteios (tem um novo todo domingo de agosto! 🎁).
          </p>
          <ol className="space-y-1.5 text-sm text-slate-600">
            <li>
              📲 <strong>Android/computador:</strong> toque no aviso{" "}
              <em>“Instalar app”</em> que aparece aqui no site.
            </li>
            <li>
              🍎 <strong>iPhone:</strong> botão Compartilhar →{" "}
              <em>Adicionar à Tela de Início</em> → abra pelo ícone novo.
            </li>
            <li>✅ Depois, toque no botão abaixo pra ativar as notificações.</li>
          </ol>
          <button
            type="button"
            onClick={enableAppPush}
            disabled={enablingPush}
            className="w-full rounded-lg bg-roxa-700 px-4 py-3 text-base font-semibold text-white hover:bg-roxa-800 disabled:opacity-60"
          >
            {enablingPush ? "Ativando…" : "🔔 Ativar notificações"}
          </button>
        </div>
      )}

      {/* PASSO: cadastro */}
      {current === "cadastro" && (
        <div className="rounded-xl border-2 border-roxa-300 bg-white p-5 space-y-3">
          <h3 className="font-serif text-lg font-bold text-roxa-900">
            {appOnly ? "Passo 2" : "Passo 1"} — Cadastro rápido
          </h3>
          <p className="text-sm text-slate-700">
            Só precisamos do seu <strong>nome</strong> e do seu <strong>WhatsApp</strong> — você
            recebe um código no WhatsApp pra confirmar que é você. Sem senha, sem formulário
            comprido.
          </p>
          <button
            type="button"
            onClick={() => setOtpOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700"
          >
            <MessageCircle className="h-5 w-5" />
            Fazer cadastro com WhatsApp
          </button>
        </div>
      )}

      {/* PASSO: escolher número */}
      {current === "numero" && (
        <div className="rounded-xl border-2 border-roxa-300 bg-white p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-serif text-lg font-bold text-roxa-900">
              {appOnly ? "Passo 3" : "Passo 2"} — Escolha seu número da sorte
            </h3>
            <button
              type="button"
              onClick={loadState}
              className="text-xs text-roxa-700 hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> atualizar
            </button>
          </div>
          {customerName && (
            <p className="text-sm text-slate-600">
              Quase lá, <strong>{customerName.split(/\s+/)[0]}</strong>!{" "}
              {isPaid
                ? `${priceFormatted} por número, pagamento via PIX.`
                : maxTicketsPerCustomer === 1
                  ? "Toque num número livre — ele é seu, de graça."
                  : "Toque nos números que quiser."}
            </p>
          )}

          <NumberGrid
            total={totalNumbers}
            taken={takenSet}
            mine={mineSet}
            selected={selected}
            onToggle={toggle}
          />
          <Legend />

          {selected.size > 0 && (
            <p className="rounded-md border border-roxa-200 bg-roxa-50 px-3 py-2 text-center text-sm">
              Número escolhido:{" "}
              <strong className="text-roxa-900">
                {Array.from(selected).sort((a, b) => a - b).join(", ")}
              </strong>
              {isPaid && (
                <>
                  {" "}
                  · Total: <strong>{totalSelectedFormatted}</strong>
                </>
              )}
            </p>
          )}

          {needsMore && selected.size > 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              O banco exige R$ 5,00 mínimo por cobrança. Selecione pelo menos{" "}
              <strong>{minNumbersForPayment} números</strong> pra continuar.
            </p>
          )}

          <button
            type="button"
            onClick={confirmNumbers}
            disabled={pending || selected.size === 0 || needsMore}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-semibold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              isPaid ? "bg-roxa-700 hover:bg-roxa-800" : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            {isPaid ? (
              <>
                <QrCode className="h-5 w-5" />
                {pending ? "Gerando PIX…" : `Pagar ${totalSelectedFormatted} via PIX`}
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                {pending ? "Confirmando…" : "Confirmar meu número 🍀"}
              </>
            )}
          </button>
        </div>
      )}

      {/* TUDO PRONTO */}
      {allDone && state && (
        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-5 space-y-3 text-center">
          <PartyPopper className="mx-auto h-10 w-10 text-green-600" />
          <h3 className="font-serif text-xl font-bold text-green-900">Você está concorrendo!</h3>
          <p className="text-sm text-green-900">
            {state.mine.filter((n) => !state.minePending.includes(n)).length > 0 ? (
              <>
                Seu número da sorte:{" "}
                <strong className="text-lg">
                  {state.mine
                    .filter((n) => !state.minePending.includes(n))
                    .sort((a, b) => a - b)
                    .join(", ")}
                </strong>
              </>
            ) : (
              <>Números aguardando pagamento: {state.minePending.sort((a, b) => a - b).join(", ")}</>
            )}
          </p>
          {drawAtLabel && (
            <p className="text-sm text-green-800">
              🗓️ Sorteio: <strong>{drawAtLabel}</strong> — você recebe uma{" "}
              <strong>notificação no app</strong> com o resultado. Boa sorte! 💜
            </p>
          )}

          {shareLink && (
            <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/70 p-3 space-y-2 text-left">
              <p className="text-sm font-semibold text-amber-900">
                <Share2 className="mr-1 inline h-4 w-4" />
                Quer aumentar sua chance? Indique um amigo!
              </p>
              <p className="text-xs text-amber-800">
                Quando alguém entrar no sorteio pelo seu link, <strong>você ganha um número
                extra</strong> automaticamente.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={share}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {shareCopied ? "Link copiado!" : "Compartilhar meu link"}
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
                  className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {state.mine.length > 0 && !allDone && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
          <CheckCircle2 className="mr-1 inline h-3 w-3" />
          Seus números: {state.mine.sort((a, b) => a - b).join(", ")}
        </div>
      )}

      <OtpLoginDialog
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        onSuccess={async () => {
          setOtpOpen(false);
          // Recarrega pro SSR enxergar o cookie novo — o assistente
          // volta já no passo do número.
          window.location.reload();
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
