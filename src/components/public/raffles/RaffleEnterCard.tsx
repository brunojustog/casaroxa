"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircle, Sparkles } from "lucide-react";
import { OtpLoginDialog } from "@/components/public/auth/OtpLoginDialog";

/**
 * Card pra cliente público participar de um sorteio:
 *   - Se já entrou: mostra número da entrada.
 *   - Se autenticado mas ainda não entrou: botão "Quero participar".
 *   - Se não autenticado: botão "Entrar pelo WhatsApp" → OTP → entra.
 */
export function RaffleEnterCard({
  raffleId,
  alreadyEntered,
  myNumber,
  authenticated,
  customerName,
}: {
  raffleId: string;
  alreadyEntered: boolean;
  myNumber: number | null;
  authenticated: boolean;
  customerName: string | null;
}) {
  const router = useRouter();
  const [otpOpen, setOtpOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [justEntered, setJustEntered] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/public/raffles/${raffleId}/enter`, {
        method: "POST",
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
      setJustEntered(data.number);
      router.refresh();
    });
  }

  // Cliente já tem entry (do banco) ou acabou de entrar
  const enteredNumber = myNumber ?? justEntered;
  if (alreadyEntered || enteredNumber !== null) {
    return (
      <div className="rounded-xl border-2 border-green-300 bg-green-50 p-5 text-center space-y-2">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <p className="font-serif text-xl font-bold text-green-900">
          Você está concorrendo!
        </p>
        <p className="text-sm text-green-800">
          Seu número da sorte é{" "}
          <span className="font-mono text-2xl font-bold text-amber-700">
            #{enteredNumber}
          </span>
        </p>
        <p className="text-xs text-green-700">
          Boa sorte! Te avisamos pelo WhatsApp se ganhar 🍀
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-roxa-200 bg-roxa-50/50 p-5 space-y-3">
      {authenticated ? (
        <>
          <p className="text-sm text-slate-700">
            Olá <strong>{customerName?.split(/\s+/)[0]}</strong>! Clique abaixo
            pra participar do sorteio com 1 entrada.
          </p>
          <button
            type="button"
            onClick={enter}
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
          >
            <Sparkles className="h-5 w-5" />
            {pending ? "Entrando…" : "Quero participar!"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-700">
            Identifique-se pelo WhatsApp pra entrar no sorteio (1 entrada por
            pessoa). Você recebe um código de 6 dígitos pra confirmar.
          </p>
          <button
            type="button"
            onClick={() => setOtpOpen(true)}
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
          >
            <MessageCircle className="h-5 w-5" />
            Entrar pelo WhatsApp e participar
          </button>
        </>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <OtpLoginDialog
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        onSuccess={() => {
          setOtpOpen(false);
          // Após login, tenta entrar automaticamente
          enter();
        }}
      />
    </div>
  );
}
