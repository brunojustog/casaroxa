/* eslint-disable no-undef */
// Service worker pra Web Push da Casa Roxa Gestão.
// Registrado em /push (ChatNotificationOptIn).
// Recebe push payload JSON: { title, body, url?, tag?, icon? }

self.addEventListener("install", () => {
  // Toma controle imediatamente — não esperar fechar todas as abas.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Casa Roxa", body: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const title = data.title || "Casa Roxa";
  const options = {
    body: data.body || "",
    tag: data.tag || "casa-roxa",
    icon: data.icon || "/logo.png",
    badge: data.icon || "/logo.png",
    data: { url: data.url || "/dashboard" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Se já tem aba aberta, foca nela.
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
