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

/**
 * Pede permissão, registra o service worker, inscreve e persiste no
 * backend. Retorna o endpoint ou null (recusado/não suportado/erro).
 */
export async function subscribeCustomerPush(
  phone?: string,
): Promise<string | null> {
  if (!isPushSupported()) return null;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return null;

    const keyRes = await fetch("/api/public/push/key");
    const keyData = await keyRes.json();
    if (!keyData.ok) return null;

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
    return sub.endpoint;
  } catch (e) {
    console.error("[push] erro ao inscrever", e);
    return null;
  }
}
