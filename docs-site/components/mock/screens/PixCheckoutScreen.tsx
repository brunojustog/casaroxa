"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  CheckCircle2,
  QrCode,
  Wallet,
  Loader2,
} from "lucide-react";

type Phase = "form" | "pix" | "paid";

/**
 * Simula a evolução: form de CPF → QR PIX exibido → confirmação de
 * pagamento. Roda em loop pra demonstrar.
 */
export function PixCheckoutScreen() {
  const [phase, setPhase] = useState<Phase>("form");
  const [cpfTyped, setCpfTyped] = useState("");
  const [copied, setCopied] = useState(false);

  // Loop demo
  useEffect(() => {
    const steps: { delay: number; action: () => void }[] = [
      { delay: 1000, action: () => setCpfTyped("123") },
      { delay: 400, action: () => setCpfTyped("123.456") },
      { delay: 400, action: () => setCpfTyped("123.456.789") },
      { delay: 400, action: () => setCpfTyped("123.456.789-09") },
      { delay: 800, action: () => setPhase("pix") },
      { delay: 2500, action: () => setCopied(true) },
      { delay: 1500, action: () => setCopied(false) },
      { delay: 1500, action: () => setPhase("paid") },
      {
        delay: 3000,
        action: () => {
          setPhase("form");
          setCpfTyped("");
          setCopied(false);
        },
      },
    ];

    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        for (const step of steps) {
          await new Promise((r) => setTimeout(r, step.delay));
          if (cancelled) return;
          step.action();
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-white p-6 min-h-[400px]">
      <header className="mb-4">
        <span className="inline-flex items-center gap-1 rounded-full bg-roxa-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-roxa-700">
          <Wallet className="h-3 w-3" /> Encomenda ER-7
        </span>
        <h3 className="mt-2 font-serif text-lg font-bold text-roxa-900">
          Sinal — R$ 50,00
        </h3>
      </header>

      {phase === "form" && (
        <div className="animate-fade-in space-y-2 max-w-sm">
          <label className="text-xs font-medium text-slate-700">
            Pra gerar o PIX, informe seu CPF:
          </label>
          <input
            value={cpfTyped}
            readOnly
            placeholder="000.000.000-00"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none"
          />
          <button
            disabled={cpfTyped.length < 14}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {cpfTyped.length === 14 ? (
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
        </div>
      )}

      {phase === "pix" && (
        <div className="animate-fade-in space-y-3 max-w-sm">
          <div className="flex flex-col items-center gap-2 rounded-md border border-slate-200 bg-white p-4">
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <QrCode className="h-3 w-3" /> Escaneie pra pagar
            </p>
            {/* QR Code simulado com SVG */}
            <div className="grid grid-cols-21 gap-px h-32 w-32 bg-white border border-slate-300">
              {Array.from({ length: 441 }).map((_, i) => (
                <span
                  key={i}
                  className={
                    Math.random() > 0.5 ? "bg-slate-900" : "bg-white"
                  }
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              ou copie o código (PIX copia-cola)
            </p>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] font-mono break-all text-slate-700">
              00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540550.005802BR5905CASA6014LENCOIS_PTA62070503***6304ABCD
            </div>
            <button
              className={
                copied
                  ? "inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white animate-fade-in"
                  : "inline-flex w-full items-center justify-center gap-2 rounded-md bg-roxa-700 px-4 py-2.5 text-sm font-semibold text-white"
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
          <div className="flex items-center justify-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Aguardando confirmação do pagamento…
          </div>
        </div>
      )}

      {phase === "paid" && (
        <div className="animate-slide-up max-w-sm rounded-xl border-2 border-green-300 bg-green-50 p-6 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-green-100 grid place-items-center animate-pulse-ring">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <p className="mt-3 text-sm font-bold uppercase tracking-wider text-green-700">
            Sinal
          </p>
          <p className="mt-1 text-base font-semibold text-green-900">
            Recebemos seu sinal de R$ 50,00 ✓
          </p>
          <p className="mt-2 text-xs text-green-800">
            Obrigado, João! Já estamos planejando a produção.
          </p>
        </div>
      )}
    </div>
  );
}
