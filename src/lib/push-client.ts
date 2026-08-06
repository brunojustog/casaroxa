/**
 * Helpers de Web Push do LADO DO CLIENTE (site público).
 * Usados pelo banner de instalação e pelo gate de sorteio exclusivo do app.
 */

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Endpoint da inscrição de push atual deste navegador, se houver. */
export async function getCurrentPushEndpoint(): Promise<string | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    return sub?.endpoint ?? null;
  } catch {
    return null;
  }
}

export type PushSubscribeResult = {
  endpoint: string | null;
  /** Por que falhou (quando endpoint é null) — permite mensagem certeira. */
  reason: "ok" | "unsupported" | "denied" | "error";
};

/** Navegador embutido de app (WhatsApp/Instagram/Facebook) — não faz push. */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /; wv\)|Instagram|FBAN|FBAV|Line\//i.test(ua);
}

/**
 * Pede permissão, registra o service worker, inscreve e persiste no
 * backend. Sempre resolve; olhe `reason` pra saber o que aconteceu.
 */
export async function subscribeCustomerPushDetailed(
  phone?: string,
): Promise<PushSubscribeResult> {
  if (!isPushSupported()) return { endpoint: null, reason: "unsupported" };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { endpoint: null, reason: "denied" };

    const keyRes = await fetch("/api/public/push/key");
    const keyData = await keyRes.json();
    if (!keyData.ok) return { endpoint: null, reason: "error" };

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
    // Métrica: instalação/ativação do app conta no painel Umami
    (window as unknown as { umami?: { track: (n: string) => void } }).umami?.track(
      "app-notificacoes-ativadas",
    );
    return { endpoint: sub.endpoint, reason: "ok" };
  } catch (e) {
    console.error("[push] erro ao inscrever", e);
    return { endpoint: null, reason: "error" };
  }
}

/** Compatível com os chamadores antigos: só o endpoint (ou null). */
export async function subscribeCustomerPush(
  phone?: string,
): Promise<string | null> {
  const r = await subscribeCustomerPushDetailed(phone);
  return r.endpoint;
}
