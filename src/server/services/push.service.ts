/**
 * Web Push API — envio de notificações pro navegador.
 *
 * Configuração: VAPID keys em env (PUSH_VAPID_PUBLIC + PUSH_VAPID_PRIVATE).
 * Gere com: `node -e "console.log(require('web-push').generateVAPIDKeys())"`
 *
 * Fluxo:
 *   1. Browser pede permissão e gera subscription (endpoint + p256dh + auth).
 *   2. Salvamos no banco (PushSubscription).
 *   3. Quando algo importante acontece (novo pedido SITE), iteramos as
 *      subscriptions e mandamos push.
 *
 * Endpoints expirados/revogados (410 do servidor de push) são removidos.
 */
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const VAPID_PUBLIC = process.env.PUSH_VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.PUSH_VAPID_PRIVATE;
const VAPID_SUBJECT =
  process.env.PUSH_VAPID_SUBJECT ?? "mailto:bruno@simplificaonline.site";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
}

export function getPushPublicKey(): string | null {
  return VAPID_PUBLIC ?? null;
}

export type PushPayload = {
  title: string;
  body: string;
  /** URL a abrir quando o usuário clica na notificação. */
  url?: string;
  /** Tag pra evitar empilhar várias notificações iguais. */
  tag?: string;
  icon?: string;
};

/**
 * Manda push pra todos os usuários inscritos. Erros isolados não interrompem
 * o batch — endpoints inválidos são limpos do banco.
 */
export async function sendPushToAllUsers(payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) {
    console.warn("[push] VAPID não configurado — pulando envio.");
    return;
  }

  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) return;

  const data = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
      } catch (e) {
        const err = e as { statusCode?: number };
        // 404/410 = endpoint morto. Limpar.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => undefined);
        } else {
          console.error("[push] falha ao enviar:", err.statusCode, e);
        }
      }
    }),
  );
}

export async function saveSubscription(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string,
  userAgent: string | null,
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh, auth, userAgent },
    create: { userId, endpoint, p256dh, auth, userAgent },
  });
}

export async function removeSubscription(endpoint: string, userId: string) {
  await prisma.pushSubscription
    .deleteMany({ where: { endpoint, userId } })
    .catch(() => undefined);
}
