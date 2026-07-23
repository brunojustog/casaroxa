"use client";

import { useEffect, useState } from "react";
import { BellRing, Download, Share, SquarePlus, X } from "lucide-react";

/**
 * Banner fixo no rodapé do site: instalar o app (PWA) e ativar notificações.
 *
 * Estados:
 *  - Navegador com beforeinstallprompt (Android/Chrome): botão "Instalar app".
 *  - iOS Safari (sem prompt nativo): guia visual "Adicionar à Tela de Início".
 *  - Já instalado (standalone) sem push: botão "Ativar notificações" com
 *    telefone opcional (vincula ao cadastro pra sorteios).
 *  - Instalado + push ativo, ou dispensado: não aparece.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "casaroxa-app-banner-dismissed";
const DISMISS_DAYS = 7;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function AppInstallBanner() {
  const [mode, setMode] = useState<
    "hidden" | "install" | "ios-guide" | "push" | "done"
  >("hidden");
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Dispensado recentemente?
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw && Date.now() - Number(raw) < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
        return;
      }
    } catch {
      /* sem localStorage — segue */
    }

    const pushSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (isStandalone()) {
      // App já instalado: oferecer push se suportado e ainda não ativo.
      if (!pushSupported || Notification.permission === "denied") return;
      (async () => {
        try {
          const reg = await navigator.serviceWorker.getRegistration("/sw.js");
          const sub = await reg?.pushManager.getSubscription();
          if (!sub) setMode("push");
        } catch {
          setMode("push");
        }
      })();
      return;
    }

    if (isIos()) {
      setMode("ios-guide");
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setMode("install");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* segue sem persistir */
    }
    setMode("hidden");
  }

  async function install() {
    if (!installEvent) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setMode("done");
        setTimeout(() => setMode("hidden"), 4000);
      }
    } finally {
      setBusy(false);
    }
  }

  async function enablePush() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;

      const keyRes = await fetch("/api/public/push/key");
      const keyData = await keyRes.json();
      if (!keyData.ok) return;

      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          keyData.publicKey,
        ) as unknown as BufferSource,
      });

      await fetch("/api/public/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sub.toJSON(), phone: phone || undefined }),
      });

      setMode("done");
      setTimeout(() => setMode("hidden"), 4000);
    } catch (e) {
      console.error("[push] erro ao ativar", e);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "hidden") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-roxa-200 bg-white/95 p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur md:p-4">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        {mode === "done" ? (
          <p className="flex-1 text-sm font-medium text-green-700">
            ✅ Tudo certo! Você vai receber nossas novidades por aqui.
          </p>
        ) : mode === "push" ? (
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-semibold text-roxa-900">
                <BellRing className="mr-1 inline h-4 w-4 text-roxa-700" />
                Ative as notificações e concorra aos sorteios do app!
              </p>
              <p className="text-xs text-slate-600">
                Avisamos das fornadas, novidades e sorteios exclusivos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.currentTarget.value)}
                placeholder="Seu WhatsApp (opcional)"
                className="h-10 w-40 rounded-md border border-slate-300 bg-white px-2.5 text-xs focus:border-roxa-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={enablePush}
                disabled={busy}
                className="h-10 shrink-0 rounded-md bg-roxa-700 px-4 text-sm font-semibold text-white hover:bg-roxa-800 disabled:opacity-60"
              >
                {busy ? "…" : "Ativar"}
              </button>
            </div>
          </div>
        ) : mode === "ios-guide" ? (
          <div className="flex-1">
            <p className="text-sm font-semibold text-roxa-900">
              📲 Instale o app da Casa Roxa no seu iPhone
            </p>
            {showIosSteps ? (
              <p className="mt-1 text-xs text-slate-600">
                Toque em <Share className="inline h-3.5 w-3.5" />{" "}
                <strong>Compartilhar</strong> na barra do Safari e depois em{" "}
                <SquarePlus className="inline h-3.5 w-3.5" />{" "}
                <strong>Adicionar à Tela de Início</strong>. Pronto!
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setShowIosSteps(true)}
                className="mt-1 text-xs font-semibold text-roxa-700 underline"
              >
                Ver como instalar (2 toques)
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-roxa-900">
                📲 Instale o app da Casa Roxa
              </p>
              <p className="text-xs text-slate-600">
                Cardápio na sua tela + sorteios exclusivos pra quem tem o app.
              </p>
            </div>
            <button
              type="button"
              onClick={install}
              disabled={busy}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-semibold text-white hover:bg-roxa-800 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {busy ? "…" : "Instalar app"}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar"
          className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
