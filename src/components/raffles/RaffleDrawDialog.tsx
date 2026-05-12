"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy, X } from "lucide-react";
import { drawRaffleAction } from "@/server/actions/raffles";

type Result = {
  winnerNumber: number;
  customerName: string;
  customerPhone: string;
};

type Phase = "spinning" | "revealing" | "done" | "error";

/**
 * Modal de sorteio com animação de roleta. Chama drawRaffleAction
 * imediatamente ao abrir e roda animação enquanto espera. Quando o
 * servidor responde com o número, desacelera até parar nele.
 */
export function RaffleDrawDialog({
  open,
  raffleId,
  totalNumbers,
  onClose,
  onDone,
}: {
  open: boolean;
  raffleId: string;
  totalNumbers: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("spinning");
  const [display, setDisplay] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setPhase("spinning");
    setDisplay(Math.floor(Math.random() * totalNumbers) + 1);
    setResult(null);
    setError(null);

    // Dispara o sorteio em paralelo à animação inicial
    drawRaffleAction(raffleId)
      .then((res) => {
        if (!res.ok) {
          setError(res.error);
          setPhase("error");
          return;
        }
        if (res.data) {
          setResult(res.data);
          // Pequeno delay pra dar sensação de "sorteando"
          setTimeout(() => setPhase("revealing"), 1200);
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Erro de rede");
        setPhase("error");
      });
  }, [open, raffleId, totalNumbers]);

  // Animação spinning — números aleatórios rápidos
  useEffect(() => {
    if (!open || phase !== "spinning") return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setDisplay(Math.floor(Math.random() * totalNumbers) + 1);
      animTimerRef.current = setTimeout(tick, 60);
    };
    tick();
    return () => {
      cancelled = true;
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [open, phase, totalNumbers]);

  // Animação revealing — desacelera até parar no número certo
  useEffect(() => {
    if (phase !== "revealing" || !result) return;
    let cancelled = false;
    const target = result.winnerNumber;
    // Sequência de tempos crescentes (desaceleração)
    const delays = [80, 100, 130, 170, 220, 280, 360, 480, 640, 850];
    let step = 0;
    const tick = () => {
      if (cancelled) return;
      if (step >= delays.length) {
        setDisplay(target);
        setPhase("done");
        return;
      }
      // Nas últimas iterações, "aproxima" do número alvo
      if (step >= delays.length - 3) {
        // Vai chegando perto do target
        const offset = delays.length - 1 - step;
        const candidate =
          ((target - offset - 1 + totalNumbers) % totalNumbers) + 1;
        setDisplay(candidate);
      } else {
        setDisplay(Math.floor(Math.random() * totalNumbers) + 1);
      }
      animTimerRef.current = setTimeout(() => {
        step++;
        tick();
      }, delays[step]);
    };
    tick();
    return () => {
      cancelled = true;
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [phase, result, totalNumbers]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="font-serif text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Sorteio em andamento
          </h3>
          {phase === "done" || phase === "error" ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (phase === "done") onDone();
              }}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </header>

        <div className="p-8 text-center space-y-5">
          {phase === "error" ? (
            <div className="space-y-3">
              <p className="text-red-700 font-medium">Não foi possível sortear</p>
              <p className="text-sm text-slate-600">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              >
                Fechar
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {phase === "spinning" && "Embaralhando…"}
                {phase === "revealing" && "Desacelerando…"}
                {phase === "done" && "Número sorteado"}
              </p>

              <div
                className={`mx-auto grid place-items-center rounded-2xl border-4 transition-all ${
                  phase === "done"
                    ? "border-amber-400 bg-amber-50 shadow-[0_0_60px_-10px_rgba(251,191,36,0.6)]"
                    : "border-roxa-300 bg-roxa-50"
                }`}
                style={{ width: 220, height: 220 }}
              >
                <span
                  className={`font-serif font-bold tabular-nums ${
                    phase === "done" ? "text-amber-700" : "text-roxa-800"
                  }`}
                  style={{ fontSize: 96, lineHeight: 1 }}
                >
                  {display}
                </span>
              </div>

              {phase === "done" && result && (
                <div className="space-y-2 pt-2">
                  <p className="font-serif text-xl font-bold text-roxa-900">
                    🎉 {result.customerName}
                  </p>
                  <p className="text-sm text-slate-600">
                    {maskPhone(result.customerPhone)}
                  </p>
                  <p className="text-xs text-slate-500 pt-2">
                    Ganhador notificado por WhatsApp.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDone();
                    }}
                    className="mt-3 inline-flex rounded-md bg-roxa-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-roxa-800"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function maskPhone(phone: string): string {
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
