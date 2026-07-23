/**
 * Wrapper da API do Asaas (gateway de pagamento brasileiro).
 *
 * Docs: https://docs.asaas.com/reference/comecando-com-a-api
 *
 * Configuração via env:
 *   ASAAS_API_KEY  — token gerado no painel Asaas em Integrações → API
 *   ASAAS_ENV      — "sandbox" (default) ou "production"
 *
 * Auth: header `access_token: <key>` (não é Bearer).
 *
 * Endpoints usados:
 *   POST /v3/customers            — cria/atualiza customer
 *   POST /v3/payments             — cria cobrança
 *   GET  /v3/payments/:id         — consulta status
 *   GET  /v3/payments/:id/pixQrCode — pega QR + chave copia-cola
 */

const SANDBOX_BASE = "https://api-sandbox.asaas.com";
const PRODUCTION_BASE = "https://api.asaas.com";

function getConfig(): { url: string; key: string } | null {
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) return null;
  const env = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase();
  const url = env === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
  return { url, key };
}

export function isAsaasConfigured(): boolean {
  return getConfig() !== null;
}

async function asaasCall<T = Record<string, unknown>>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const config = getConfig();
  if (!config) {
    return { ok: false, status: 0, error: "Asaas não configurado (env vars faltando)." };
  }
  try {
    const res = await fetch(`${config.url}${path}`, {
      method,
      headers: {
        access_token: config.key,
        "Content-Type": "application/json",
        "User-Agent": "casaroxa-gestao/1.0",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });

    const data = (await res.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (!res.ok) {
      // Asaas retorna erro em data.errors: [{description: "..."}, ...]
      const errors = (data as { errors?: { description?: string }[] } | null)
        ?.errors;
      const msg =
        (errors && errors[0]?.description) ??
        (data as { message?: string } | null)?.message ??
        `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: msg };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "Erro de rede.",
    };
  }
}

// ---------- Customer ----------

export type AsaasCustomer = {
  id: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
};

/**
 * Asaas exige `mobilePhone` no formato brasileiro: só DDD + número (10
 * ou 11 dígitos), SEM o DDI 55. Mandar com DDI (ex.: 5514997445729) faz
 * o Asaas reclamar por email "número incorreto". Nosso Customer.phone é
 * salvo com DDI 55 pra usar com a Wuzapi; aqui a gente remove.
 */
function toAsaasPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

export async function createAsaasCustomer(input: {
  name: string;
  phone: string;
  email?: string | null;
  cpfCnpj: string;
}): Promise<{ ok: true; customerId: string } | { ok: false; error: string }> {
  const r = await asaasCall<AsaasCustomer>("POST", "/v3/customers", {
    name: input.name,
    mobilePhone: toAsaasPhone(input.phone),
    email: input.email ?? undefined,
    cpfCnpj: input.cpfCnpj,
    // notificationDisabled: true → não dispara notificações próprias do Asaas
    notificationDisabled: true,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, customerId: r.data.id };
}

/**
 * Atualiza um customer existente no Asaas. Útil quando o customer foi criado
 * sem CPF (versão antiga) e precisamos preencher pra emitir cobrança PIX.
 */
export async function updateAsaasCustomer(
  asaasCustomerId: string,
  patch: { cpfCnpj?: string; email?: string | null; phone?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body: Record<string, unknown> = {};
  if (patch.cpfCnpj) body.cpfCnpj = patch.cpfCnpj;
  if (patch.email !== undefined) body.email = patch.email ?? undefined;
  if (patch.phone) body.mobilePhone = toAsaasPhone(patch.phone);
  const r = await asaasCall<AsaasCustomer>(
    "POST",
    `/v3/customers/${asaasCustomerId}`,
    body,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true };
}

// ---------- Payment ----------

export type AsaasPayment = {
  id: string;
  status: string; // PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, etc.
  value: number;
  billingType: string; // PIX, CREDIT_CARD, BOLETO, UNDEFINED
  invoiceUrl?: string;
  bankSlipUrl?: string;
  dueDate: string;
  description?: string;
};

export async function createAsaasPayment(input: {
  customerId: string;
  billingType: "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED";
  value: number;
  dueDate: Date;
  description: string;
  externalReference?: string;
}): Promise<{ ok: true; payment: AsaasPayment } | { ok: false; error: string }> {
  const r = await asaasCall<AsaasPayment>("POST", "/v3/payments", {
    customer: input.customerId,
    billingType: input.billingType,
    value: Number(input.value.toFixed(2)),
    dueDate: input.dueDate.toISOString().slice(0, 10),
    description: input.description.slice(0, 500),
    externalReference: input.externalReference,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, payment: r.data };
}

/**
 * Troca o billingType de uma cobrança PENDENTE (ex.: cliente clicou em
 * Cartão, mudou de ideia e quer PIX). Asaas só permite em cobrança não paga.
 */
export async function updateAsaasPaymentBillingType(
  paymentId: string,
  billingType: "PIX" | "CREDIT_CARD",
): Promise<{ ok: true; payment: AsaasPayment } | { ok: false; error: string }> {
  const r = await asaasCall<AsaasPayment>("PUT", `/v3/payments/${paymentId}`, {
    billingType,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, payment: r.data };
}

export type AsaasPixQrCode = {
  encodedImage: string; // base64 PNG
  payload: string; // chave copia-cola
  expirationDate?: string;
};

export async function getAsaasPixQrCode(
  paymentId: string,
): Promise<{ ok: true; qr: AsaasPixQrCode } | { ok: false; error: string }> {
  const r = await asaasCall<AsaasPixQrCode>(
    "GET",
    `/v3/payments/${paymentId}/pixQrCode`,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, qr: r.data };
}

export async function getAsaasPayment(
  paymentId: string,
): Promise<{ ok: true; payment: AsaasPayment } | { ok: false; error: string }> {
  const r = await asaasCall<AsaasPayment>("GET", `/v3/payments/${paymentId}`);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, payment: r.data };
}

// ---------- Status check (pra testar conexão) ----------

export async function ping(): Promise<{
  ok: boolean;
  env: "sandbox" | "production";
  error?: string;
}> {
  const config = getConfig();
  if (!config) {
    return { ok: false, env: "sandbox", error: "Não configurado." };
  }
  const env: "sandbox" | "production" =
    config.url === PRODUCTION_BASE ? "production" : "sandbox";
  // /v3/customers?limit=1 é uma chamada leve só pra validar credenciais
  const r = await asaasCall("GET", "/v3/customers?limit=1");
  if (!r.ok) {
    return { ok: false, env, error: r.error };
  }
  return { ok: true, env };
}

// ---------- Mapeamento de status Asaas → nosso ----------

import type { OnlinePaymentStatus } from "@prisma/client";

export function mapAsaasStatus(asaasStatus: string): OnlinePaymentStatus {
  switch (asaasStatus.toUpperCase()) {
    case "RECEIVED":
    case "RECEIVED_IN_CASH":
      return "RECEIVED";
    case "CONFIRMED":
      return "CONFIRMED";
    case "OVERDUE":
      return "OVERDUE";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "REFUND_IN_PROGRESS":
      return "REFUNDED";
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
    case "DUNNING_REQUESTED":
    case "DUNNING_RECEIVED":
      return "FAILED";
    case "PENDING":
    case "AWAITING_RISK_ANALYSIS":
    default:
      return "PENDING";
  }
}
