/**
 * Integração com a wuzapi (https://wuzapi.brunojusto.com.br).
 *
 * Configuração via env:
 *   WHATSAPP_API_URL          base da instância (ex.: https://wuzapi.brunojusto.com.br)
 *   WHATSAPP_API_TOKEN        token da instância (header `token`)
 *
 * Toggles de eventos vivem em Settings (whatsappApiEnabled + whatsappNotify*).
 * O master switch (Settings.whatsappApiEnabled) tem precedência: se false,
 * tudo é skipado independente dos toggles individuais.
 *
 * Cada envio gera um WhatsAppMessageLog com status SENT/FAILED/SKIPPED.
 */
import { WhatsAppEvent, WhatsAppMessageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ---------- Tipos ----------

export type SendTextResult =
  | { ok: true; status: "SENT"; logId: string; externalId?: string }
  | { ok: true; status: "SKIPPED"; logId: string; reason: string }
  | { ok: false; status: "FAILED"; logId: string; error: string };

export type SendTextInput = {
  phone: string;
  message: string;
  event: WhatsAppEvent;
  customerId?: string | null;
  saleId?: string | null;
  /** Pula o gate dos toggles (ex.: botão "Testar conexão" em /configuracoes). */
  bypassToggles?: boolean;
  /** Toggle específico do evento — checado se bypassToggles=false. */
  toggleField?:
    | "whatsappNotifyConfirmed"
    | "whatsappNotifyReady"
    | "whatsappNotifyOnDelivery"
    | "whatsappNotifyBirthday"
    | "whatsappNotifyLoyaltyRedeem";
  /** Atraso de digitação em ms (default 1500). */
  typingDelayMs?: number;
};

export type WhatsAppStatusResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

// ---------- Helpers ----------

function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, "");
}

function getConfig(): { url: string; token: string } | null {
  const url = process.env.WHATSAPP_API_URL?.trim().replace(/\/+$/, "");
  const token = process.env.WHATSAPP_API_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

async function logMessage(input: {
  customerId?: string | null;
  saleId?: string | null;
  phone: string;
  event: WhatsAppEvent;
  message: string;
  status: WhatsAppMessageStatus;
  errorMessage?: string | null;
  externalId?: string | null;
}) {
  return prisma.whatsAppMessageLog.create({
    data: {
      customerId: input.customerId ?? null,
      saleId: input.saleId ?? null,
      phone: input.phone,
      event: input.event,
      message: input.message.slice(0, 4000),
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      externalId: input.externalId ?? null,
    },
    select: { id: true },
  });
}

// ---------- Public API ----------

export function isWhatsAppConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Verifica se as notificações estão habilitadas pra um evento específico.
 * Aplica a hierarquia: master switch + toggle individual.
 */
export async function isEventEnabled(
  toggleField: NonNullable<SendTextInput["toggleField"]>,
): Promise<boolean> {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: {
      whatsappApiEnabled: true,
      whatsappNotifyConfirmed: true,
      whatsappNotifyReady: true,
      whatsappNotifyOnDelivery: true,
      whatsappNotifyBirthday: true,
      whatsappNotifyLoyaltyRedeem: true,
    },
  });
  if (!settings || !settings.whatsappApiEnabled) return false;
  return Boolean(settings[toggleField]);
}

/**
 * Envia mensagem de texto via wuzapi. Sempre retorna (não throws),
 * mesmo em falha — o caller decide se quer reagir.
 *
 * Tudo registrado em WhatsAppMessageLog.
 */
export async function sendText(input: SendTextInput): Promise<SendTextResult> {
  const phone = normalizePhone(input.phone);
  const event = input.event;

  if (!phone || phone.length < 10) {
    const log = await logMessage({
      ...input,
      phone,
      status: WhatsAppMessageStatus.SKIPPED,
      errorMessage: "Telefone inválido (precisa ter DDI + DDD + número).",
    });
    return {
      ok: true,
      status: "SKIPPED",
      logId: log.id,
      reason: "Telefone inválido",
    };
  }

  // Gate de configuração + toggles.
  if (!input.bypassToggles) {
    const config = getConfig();
    if (!config) {
      const log = await logMessage({
        ...input,
        phone,
        status: WhatsAppMessageStatus.SKIPPED,
        errorMessage: "WhatsApp não configurado (env WHATSAPP_API_URL/_TOKEN faltando).",
      });
      return {
        ok: true,
        status: "SKIPPED",
        logId: log.id,
        reason: "API não configurada",
      };
    }
    if (input.toggleField) {
      const enabled = await isEventEnabled(input.toggleField);
      if (!enabled) {
        const log = await logMessage({
          ...input,
          phone,
          status: WhatsAppMessageStatus.SKIPPED,
          errorMessage: "Toggle do evento desligado em /configuracoes.",
        });
        return {
          ok: true,
          status: "SKIPPED",
          logId: log.id,
          reason: "Notificação desligada",
        };
      }
    }
  }

  const config = getConfig();
  if (!config) {
    const log = await logMessage({
      ...input,
      phone,
      status: WhatsAppMessageStatus.FAILED,
      errorMessage: "WhatsApp não configurado.",
    });
    return {
      ok: false,
      status: "FAILED",
      logId: log.id,
      error: "WhatsApp não configurado",
    };
  }

  const body = {
    phone,
    body: input.message,
    delay: typeof input.typingDelayMs === "number" ? input.typingDelayMs : 1500,
    linkPreview: true,
    mentionAll: false,
  };

  try {
    const res = await fetch(`${config.url}/chat/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: config.token,
      },
      body: JSON.stringify(body),
      // Timeout razoável — wuzapi às vezes demora pra confirmar.
      signal: AbortSignal.timeout(15_000),
    });

    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      /* corpo vazio ou não-JSON */
    }

    if (!res.ok) {
      const errMsg =
        (parsed as { error?: string; message?: string } | null)?.error ??
        (parsed as { message?: string } | null)?.message ??
        `HTTP ${res.status}`;
      const log = await logMessage({
        ...input,
        phone,
        status: WhatsAppMessageStatus.FAILED,
        errorMessage: errMsg,
      });
      return { ok: false, status: "FAILED", logId: log.id, error: errMsg };
    }

    const externalId =
      (parsed as { id?: string; messageId?: string; data?: { id?: string } } | null)?.id ??
      (parsed as { messageId?: string } | null)?.messageId ??
      (parsed as { data?: { id?: string } } | null)?.data?.id ??
      null;

    const log = await logMessage({
      ...input,
      phone,
      status: WhatsAppMessageStatus.SENT,
      externalId,
    });
    return {
      ok: true,
      status: "SENT",
      logId: log.id,
      externalId: externalId ?? undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro de rede.";
    const log = await logMessage({
      ...input,
      phone,
      status: WhatsAppMessageStatus.FAILED,
      errorMessage: msg,
    });
    return { ok: false, status: "FAILED", logId: log.id, error: msg };
  }
}

/**
 * Wrapper genérico pra chamadas autenticadas na wuzapi.
 * Centraliza header `token`, timeout e parsing de erro.
 */
async function wuzapiCall(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; error?: string }> {
  const config = getConfig();
  if (!config) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "WhatsApp não configurado (env vars faltando).",
    };
  }
  try {
    const res = await fetch(`${config.url}${path}`, {
      method,
      headers: {
        token: config.token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!res.ok) {
      const err =
        ((data as { error?: string; message?: string } | null)?.error ??
          (data as { message?: string } | null)?.message ??
          `HTTP ${res.status}`);
      return { ok: false, status: res.status, data, error: err };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e instanceof Error ? e.message : "Erro de rede.",
    };
  }
}

/**
 * Status da conexão com WhatsApp (se o número está conectado, etc).
 */
export async function checkConnectionStatus(): Promise<WhatsAppStatusResult> {
  const r = await wuzapiCall("GET", "/session/status");
  if (!r.ok) return { ok: false, error: r.error ?? "Falha ao consultar status." };
  return { ok: true, data: r.data ?? {} };
}

/**
 * Inicia o processo de conexão da instância (gera/atualiza QR code).
 * Comportamento depende da versão do wuzapi:
 *   - algumas retornam o QR direto na resposta
 *   - outras só inicializam e o QR vem em GET /session/qr depois
 */
export async function connectSession(): Promise<{
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const r = await wuzapiCall("POST", "/session/connect", {
    Subscribe: ["Message", "ReadReceipt", "ChatPresence"],
    Immediate: true,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data ?? {} };
}

/**
 * Pega QR code atual. Retorna a string base64 ou data URL.
 * Se o wuzapi voltar com vários formatos diferentes, o caller decide
 * como renderizar (campos comuns: code, qrcode, base64, data).
 */
export async function getQRCode(): Promise<{
  ok: boolean;
  qrcode?: string;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const r = await wuzapiCall("GET", "/session/qr");
  if (!r.ok) return { ok: false, error: r.error };
  const data = r.data ?? {};
  // Tenta extrair o QR de campos conhecidos.
  const qrcode =
    (data.code as string | undefined) ??
    (data.qrcode as string | undefined) ??
    ((data.data as { qrcode?: string; code?: string } | undefined)?.qrcode ??
      (data.data as { qrcode?: string; code?: string } | undefined)?.code) ??
    (data.QRCode as string | undefined);
  return { ok: true, qrcode, data };
}

/**
 * Desconecta a sessão (logout completo — cliente vai precisar parear de novo).
 */
export async function logoutSession(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const r = await wuzapiCall("POST", "/session/logout");
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true };
}

// ---------- Listagem de logs (UI) ----------

export async function listMessageLogs(filters: {
  event?: WhatsAppEvent;
  status?: WhatsAppMessageStatus;
  customerId?: string;
  limit?: number;
}) {
  return prisma.whatsAppMessageLog.findMany({
    where: {
      ...(filters.event ? { event: filters.event } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(filters.limit ?? 100, 500),
  });
}
