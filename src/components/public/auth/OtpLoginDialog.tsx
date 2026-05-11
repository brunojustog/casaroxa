"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, RefreshCw, X } from "lucide-react";

type Phase = "phone" | "code" | "verifying" | "success" | "no-account";

/**
 * Modal de identificação por OTP no WhatsApp.
 *
 * Fluxo:
 *   1. phone   → cliente digita telefone, clica "Receber código"
 *   2. code    → cliente cola o código de 6 dígitos do WhatsApp
 *   3. success → cookie de sessão setado, chama onSuccess()
 *
 * Casos especiais:
 *   - no-account: código bate mas não tem Customer com esse telefone.
 *     Cliente segue como convidado (faz pedido normal, será cadastrado).
 */
export function OtpLoginDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // Reset state ao abrir
  useEffect(() => {
    if (!open) return;
    setPhase("phone");
    setCode("");
    setError(null);
    setChallengeId(null);
  }, [open]);

  // Foca o input de código quando entra na fase
  useEffect(() => {
    if (phase === "code" && codeRef.current) {
      codeRef.current.focus();
    }
  }, [phase]);

  // Countdown pra liberar reenvio
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function requestCode() {
    setError(null);
    if (phone.replace(/\D+/g, "").length < 10) {
      setError("Digite um telefone válido com DDD.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/public/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Falha ao enviar código.");
        return;
      }
      setChallengeId(data.challengeId);
      setPhase("code");
      setResendIn(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!challengeId) return;
    setError(null);
    const clean = code.replace(/\D+/g, "");
    if (clean.length !== 6) {
      setError("Código deve ter 6 dígitos.");
      return;
    }
    setBusy(true);
    setPhase("verifying");
    try {
      const res = await fetch("/api/public/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code: clean }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Código inválido.");
        setPhase("code");
        return;
      }
      if (!data.authenticated) {
        setPhase("no-account");
        return;
      }
      setPhase("success");
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede.");
      setPhase("code");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="font-serif text-lg font-semibold text-slate-900">
            Já é cliente?
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5">
          {phase === "phone" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Digite seu telefone com DDD. Vamos enviar um código no
                WhatsApp pra carregar seus dados.
              </p>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Telefone (com DDD)
                </label>
                <input
                  type="tel"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy) {
                      e.preventDefault();
                      requestCode();
                    }
                  }}
                  placeholder="(14) 99999-9999"
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-base focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                />
              </div>
              {error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={requestCode}
                disabled={busy || phone.length < 10}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                <MessageCircle className="h-4 w-4" />
                {busy ? "Enviando…" : "Receber código no WhatsApp"}
              </button>
            </div>
          )}

          {(phase === "code" || phase === "verifying") && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setPhase("phone")}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar
              </button>
              <p className="text-sm text-slate-600">
                Enviamos um código de 6 dígitos pro WhatsApp{" "}
                <strong>{phone}</strong>. Cole abaixo:
              </p>
              <div>
                <input
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.currentTarget.value.replace(/\D+/g, ""))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy && code.length === 6) {
                      e.preventDefault();
                      verifyCode();
                    }
                  }}
                  placeholder="000000"
                  className="h-14 w-full rounded-md border border-slate-300 px-3 text-center text-2xl font-mono tracking-[0.5em] focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                />
              </div>
              {error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={verifyCode}
                disabled={busy || code.length !== 6}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-roxa-700 px-5 py-3 text-sm font-semibold text-white hover:bg-roxa-800 disabled:opacity-50"
              >
                {phase === "verifying" ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Verificando…
                  </>
                ) : (
                  "Confirmar código"
                )}
              </button>
              <div className="text-center text-xs text-slate-500">
                Não recebeu?{" "}
                {resendIn > 0 ? (
                  <span>Aguarde {resendIn}s pra reenviar.</span>
                ) : (
                  <button
                    type="button"
                    onClick={requestCode}
                    disabled={busy}
                    className="text-roxa-700 hover:underline"
                  >
                    Reenviar código
                  </button>
                )}
              </div>
            </div>
          )}

          {phase === "success" && (
            <div className="py-6 text-center">
              <div className="mx-auto h-16 w-16 grid place-items-center rounded-full bg-green-100 text-green-700 mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-base font-semibold text-slate-900">
                Tudo certo!
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Carregando seus dados…
              </p>
            </div>
          )}

          {phase === "no-account" && (
            <div className="py-2 text-center space-y-3">
              <p className="text-sm text-slate-700">
                Código confirmado, mas{" "}
                <strong>esse telefone ainda não tem cadastro</strong> na Casa Roxa.
              </p>
              <p className="text-sm text-slate-600">
                É só seguir o checkout normalmente — vamos guardar seus dados pra
                facilitar o próximo pedido!
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-roxa-700 px-4 py-2 text-sm font-medium text-white hover:bg-roxa-800"
              >
                Continuar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
