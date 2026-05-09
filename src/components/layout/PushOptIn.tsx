"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

type Status = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Botão pra ativar/desativar notificações push deste navegador.
 *
 * Vai morar no header. Em iOS Safari só funciona se o site tiver sido
 * adicionado à tela inicial — caso contrário o botão fica oculto.
 */
export function PushOptIn() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        if (!reg) {
          setStatus("unsubscribed");
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "subscribed" : "unsubscribed");
      } catch {
        setStatus("unsubscribed");
      }
    })();
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      // Pede permissão (no-op se já concedida).
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "unsubscribed");
        return;
      }

      // Pega chave pública VAPID do servidor.
      const keyRes = await fetch("/api/push/public-key");
      const keyData = await keyRes.json();
      if (!keyData.ok) {
        window.alert(
          "Notificações não estão configuradas no servidor. Avise o administrador.",
        );
        return;
      }

      // Registra service worker e subscreve.
      const reg = await navigator.serviceWorker.register("/sw.js");
      // Cast: TS 5.x reclama de SharedArrayBuffer vs ArrayBuffer no Uint8Array,
      // mas o que a API web aceita é o BufferSource — funciona normalmente.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          keyData.publicKey,
        ) as unknown as BufferSource,
      });

      // Manda subscription pro backend persistir.
      const subJson = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subJson),
      });

      setStatus("subscribed");
    } catch (e) {
      console.error("[push] erro ao inscrever", e);
      window.alert("Não consegui ativar notificações neste navegador.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("unsubscribed");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || status === "unsupported") return null;

  if (status === "denied") {
    return (
      <button
        type="button"
        title="Permissão negada — habilite nas configurações do navegador"
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 h-9 text-xs text-slate-400 cursor-not-allowed"
        disabled
      >
        <BellOff className="h-4 w-4" />
        <span className="hidden md:inline">Bloqueado</span>
      </button>
    );
  }

  if (status === "subscribed") {
    return (
      <button
        type="button"
        onClick={unsubscribe}
        disabled={busy}
        title="Notificações ativas — clique pra desativar"
        className="inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-green-50 px-2.5 h-9 text-xs font-medium text-green-800 hover:bg-green-100 disabled:opacity-50"
      >
        <BellRing className="h-4 w-4" />
        <span className="hidden md:inline">Push ativo</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={subscribe}
      disabled={busy}
      title="Receber notificação de novos pedidos neste navegador"
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 h-9 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      <Bell className="h-4 w-4" />
      <span className="hidden md:inline">{busy ? "…" : "Ativar push"}</span>
    </button>
  );
}
