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

// ============================================================
// Push de CLIENTES (app do site) — canal de marketing
// ============================================================

/**
 * Salva inscrição de push de um cliente do site. Se veio telefone,
 * tenta vincular ao Customer existente (mesma normalização do checkout).
 */
export async function saveCustomerSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  phone?: string | null;
}) {
  let customerId: string | null = null;
  const phone = input.phone?.trim() || null;
  if (phone) {
    const digits = phone.replace(/\D+/g, "");
    if (digits.length >= 10) {
      const customer = await prisma.customer.findFirst({
        // Telefones são gravados em formatos variados — compara por dígitos.
        where: { phone: { contains: digits.slice(-8) } },
        select: { id: true },
      });
      customerId = customer?.id ?? null;
    }
  }
  return prisma.customerPushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent,
      ...(phone ? { phone } : {}),
      ...(customerId ? { customerId } : {}),
    },
    create: {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent,
      phone,
      customerId,
    },
  });
}

export async function removeCustomerSubscription(endpoint: string) {
  await prisma.customerPushSubscription
    .deleteMany({ where: { endpoint } })
    .catch(() => undefined);
}

export async function countCustomerSubscriptions(): Promise<number> {
  return prisma.customerPushSubscription.count();
}

/**
 * Broadcast pra todos os clientes com app/notificações ativas.
 * Registra o disparo em PushBroadcast e limpa endpoints mortos.
 */
export async function sendPushToAllCustomers(payload: PushPayload): Promise<{
  sent: number;
  failed: number;
  broadcastId: string;
}> {
  if (!ensureConfigured()) {
    throw new Error("Push não configurado no servidor (VAPID ausente).");
  }

  const subs = await prisma.customerPushSubscription.findMany();
  const data = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
        sent++;
      } catch (e) {
        const err = e as { statusCode?: number };
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.customerPushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => undefined);
        } else {
          failed++;
          console.error("[push-clientes] falha:", err.statusCode, e);
        }
      }
    }),
  );

  const broadcast = await prisma.pushBroadcast.create({
    data: {
      title: payload.title,
      body: payload.body,
      url: payload.url ?? null,
      sentCount: sent,
      failCount: failed,
    },
    select: { id: true },
  });

  return { sent, failed, broadcastId: broadcast.id };
}

export async function listPushBroadcasts(limit = 20) {
  return prisma.pushBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
