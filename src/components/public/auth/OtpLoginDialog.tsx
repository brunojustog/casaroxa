"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, RefreshCw, UserPlus, X } from "lucide-react";

type Phase =
  | "phone"
  | "code"
  | "verifying"
  | "name" // telefone verificado mas sem cadastro — pede nome pra criar
  | "registering"
  | "success";

/**
 * Modal de identificação por OTP no WhatsApp.
 *
 * Fluxo:
 *   1. phone   → cliente digita telefone, clica "Receber código"
 *   2. code    → cliente cola o código de 6 dígitos do WhatsApp
 *   3a. success → tinha Customer, cookie de sessão criado
 *   3b. name   → não tinha Customer; pede nome e cria cadastro completo
 *       → registering → success
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
  const [newName, setNewName] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Reset state ao abrir
  useEffect(() => {
    if (!open) return;
    setPhase("phone");
    setCode("");
    setNewName("");
    setError(null);
    setChallengeId(null);
  }, [open]);

  // Foca o input certo quando entra em cada fase
  useEffect(() => {
    if (phase === "code" && codeRef.current) codeRef.current.focus();
    if (phase === "name" && nameRef.current) nameRef.current.focus();
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
        // Telefone verificado, mas sem Customer ainda — pede nome
        // e finaliza cadastro na próxima etapa.
        setPhase("name");
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

  async function completeSignup() {
    setError(null);
    const cleanName = newName.trim();
    if (cleanName.length < 2) {
      setError("Digite seu nome (pelo menos 2 letras).");
      return;
    }
    setBusy(true);
    setPhase("registering");
    try {
      const res = await fetch("/api/public/customer/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Falha ao finalizar cadastro.");
        setPhase("name");
        return;
      }
      setPhase("success");
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede.");
      setPhase("name");
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
            {phase === "name" || phase === "registering"
              ? "Criar cadastro"
              : "Entrar pelo WhatsApp"}
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

          {(phase === "name" || phase === "registering") && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-roxa-100 text-roxa-700 mb-2">
                  <UserPlus className="h-5 w-5" />
                </div>
                <h4 className="font-serif text-base font-semibold text-slate-900">
                  Quase lá! Só falta seu nome
                </h4>
                <p className="mt-1 text-xs text-slate-600">
                  Seu telefone foi verificado. Como devemos te chamar?
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Nome completo
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  autoComplete="name"
                  value={newName}
                  onChange={(e) => setNewName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy && newName.trim().length >= 2) {
                      e.preventDefault();
                      completeSignup();
                    }
                  }}
                  placeholder="Ex.: Maria Silva"
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
                onClick={completeSignup}
                disabled={busy || newName.trim().length < 2}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {phase === "registering" ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Criando cadastro…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Finalizar cadastro
                  </>
                )}
              </button>
              <p className="text-[11px] text-slate-500 text-center">
                Seu telefone é só pra Casa Roxa entrar em contato. Não compartilhamos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
