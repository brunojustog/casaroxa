/**
 * Orquestração de pagamento online (Asaas) — entre o checkout público
 * da Casa Roxa e o gateway.
 *
 * Fluxo principal:
 *   1. Cliente termina checkout escolhendo PIX/Cartão online.
 *   2. initiateOnlinePayment(saleId, billingType):
 *      - garante que o Customer da Casa Roxa tem asaasCustomerId (cria se não)
 *      - cria Payment no Asaas com vencimento +N horas (Settings.asaasPaymentTtlHours)
 *      - se PIX: pega QR code + payload e salva
 *      - se CREDIT_CARD: usa invoiceUrl (checkout transparente do Asaas)
 *      - cria OnlinePayment local com status PENDING
 *   3. Cliente paga.
 *   4. Asaas dispara webhook → handlePaymentWebhook atualiza status e,
 *      se virou RECEIVED/CONFIRMED, marca Sale como CONCLUIDA + dispara
 *      WhatsApp pro cliente.
 */
import {
  OnlinePaymentBillingType,
  OnlinePaymentStatus,
  Prisma,
  SaleStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import {
  createAsaasCustomer,
  createAsaasPayment,
  getAsaasPixQrCode,
  isAsaasConfigured,
  mapAsaasStatus,
  updateAsaasCustomer,
} from "./asaas.service";
import { sendText } from "./whatsapp.service";

const DEFAULT_TTL_HOURS = 24;

/**
 * Erro especial — sinaliza pra UI pedir CPF do cliente antes de prosseguir.
 * Asaas exige CPF/CNPJ pra criar cobrança PIX/cartão (obrigação fiscal).
 */
export class NeedCpfError extends BusinessError {
  constructor() {
    super("Precisamos do seu CPF pra emitir a cobrança. Informe abaixo.");
    this.name = "NeedCpfError";
  }
}

async function getOrCreateAsaasCustomer(
  customerId: string,
  cpfCnpjOverride?: string,
): Promise<{ asaasCustomerId: string }> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      asaasCustomerId: true,
      cpfCnpj: true,
    },
  });
  if (!customer) throw new BusinessError("Cliente não encontrado.");

  // CPF é obrigatório pra Asaas — sempre exige ANTES de criar/usar customer.
  const cpfCnpj = cpfCnpjOverride ?? customer.cpfCnpj;
  if (!cpfCnpj) {
    throw new NeedCpfError();
  }

  // Salva CPF no Customer local pra próximas cobranças (se veio override novo)
  if (cpfCnpjOverride && cpfCnpjOverride !== customer.cpfCnpj) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { cpfCnpj: cpfCnpjOverride },
    });
  }

  // Já existe no Asaas? Garante que o CPF está sincronizado lá
  // (cobre o caso de customer criado por versão antiga, sem CPF).
  if (customer.asaasCustomerId) {
    if (!customer.cpfCnpj) {
      // CPF é novo — sincroniza no Asaas
      const updated = await updateAsaasCustomer(customer.asaasCustomerId, {
        cpfCnpj,
      });
      if (!updated.ok) {
        throw new BusinessError(
          `Falha ao atualizar cliente no Asaas: ${updated.error}`,
        );
      }
    }
    return { asaasCustomerId: customer.asaasCustomerId };
  }

  const created = await createAsaasCustomer({
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    cpfCnpj,
  });
  if (!created.ok) {
    throw new BusinessError(
      `Falha ao criar cliente no Asaas: ${created.error}`,
    );
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { asaasCustomerId: created.customerId },
  });

  return { asaasCustomerId: created.customerId };
}

export type InitiateOnlinePaymentResult = {
  paymentId: string; // OnlinePayment.id
  billingType: OnlinePaymentBillingType;
  status: OnlinePaymentStatus;
  /** Só PIX */
  pixPayload?: string | null;
  pixQrCodeBase64?: string | null;
  /** Só CREDIT_CARD (e fallback de PIX): URL do checkout do Asaas */
  invoiceUrl?: string | null;
  value: number;
  dueDate: Date;
};

/**
 * Inicia (ou retorna existente) o OnlinePayment de uma Sale. Idempotente —
 * chamar 2x retorna o mesmo registro.
 *
 * Asaas exige CPF/CNPJ do cliente. Se ainda não tem cadastrado e nada veio
 * em `cpfCnpj`, lança `NeedCpfError` pra UI pedir.
 */
export async function initiateOnlinePayment(
  saleId: string,
  billingType: OnlinePaymentBillingType,
  cpfCnpj?: string,
): Promise<InitiateOnlinePaymentResult> {
  if (!isAsaasConfigured()) {
    throw new BusinessError(
      "Pagamento online não configurado. Avise o administrador da Casa Roxa.",
    );
  }

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      number: true,
      status: true,
      totalRevenue: true,
      couponDiscount: true,
      customerId: true,
      onlinePayment: true,
    },
  });
  if (!sale) throw new BusinessError("Pedido não encontrado.");
  if (sale.status === SaleStatus.CANCELADA) {
    throw new BusinessError("Pedido cancelado — não pode pagar.");
  }

  // Já tem payment? Retorna o existente (idempotente).
  if (sale.onlinePayment) {
    const p = sale.onlinePayment;
    return {
      paymentId: p.id,
      billingType: p.billingType,
      status: p.status,
      pixPayload: p.pixPayload,
      pixQrCodeBase64: p.pixQrCodeBase64,
      invoiceUrl: p.invoiceUrl,
      value: Number(p.value),
      dueDate: p.dueDate,
    };
  }

  if (!sale.customerId) {
    throw new BusinessError(
      "Pedido sem cliente identificado. Identifique-se pelo WhatsApp primeiro.",
    );
  }

  const value =
    Number(sale.totalRevenue) - Number(sale.couponDiscount);
  if (value <= 0) {
    throw new BusinessError("Valor do pedido inválido pra cobrança online.");
  }

  const { asaasCustomerId } = await getOrCreateAsaasCustomer(
    sale.customerId,
    cpfCnpj,
  );

  // TTL — busca settings
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { asaasPaymentTtlHours: true },
  });
  const ttlHours = settings?.asaasPaymentTtlHours ?? DEFAULT_TTL_HOURS;
  const dueDate = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  // Cria payment no Asaas
  const asaasResult = await createAsaasPayment({
    customerId: asaasCustomerId,
    billingType: billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX",
    value,
    dueDate,
    description: `Casa Roxa — Pedido #${sale.number}`,
    externalReference: sale.id,
  });
  if (!asaasResult.ok) {
    throw new BusinessError(`Falha no Asaas: ${asaasResult.error}`);
  }
  const asaasPayment = asaasResult.payment;

  // Se PIX, busca QR code
  let pixPayload: string | null = null;
  let pixQrCodeBase64: string | null = null;
  if (billingType === "PIX") {
    const qr = await getAsaasPixQrCode(asaasPayment.id);
    if (qr.ok) {
      pixPayload = qr.qr.payload;
      pixQrCodeBase64 = qr.qr.encodedImage;
    }
    // Falha ao pegar QR não é fatal — invoiceUrl serve como fallback.
  }

  const created = await prisma.onlinePayment.create({
    data: {
      saleId: sale.id,
      asaasPaymentId: asaasPayment.id,
      asaasCustomerId,
      billingType,
      value,
      status: mapAsaasStatus(asaasPayment.status),
      invoiceUrl: asaasPayment.invoiceUrl ?? null,
      pixPayload,
      pixQrCodeBase64,
      dueDate,
    },
  });

  return {
    paymentId: created.id,
    billingType: created.billingType,
    status: created.status,
    pixPayload: created.pixPayload,
    pixQrCodeBase64: created.pixQrCodeBase64,
    invoiceUrl: created.invoiceUrl,
    value: Number(created.value),
    dueDate: created.dueDate,
  };
}

// ---------- Status / consulta ----------

export async function getOnlinePaymentBySaleId(saleId: string) {
  return prisma.onlinePayment.findUnique({
    where: { saleId },
  });
}

// ---------- Webhook handler ----------

/**
 * Processa um evento de webhook do Asaas. Idempotente — se status não
 * mudou, não dispara side effects de novo. Eventos comuns:
 *   PAYMENT_CREATED      — ignorado (já criamos local antes do webhook)
 *   PAYMENT_RECEIVED     — PIX caiu (instantâneo) ou cartão autorizado
 *   PAYMENT_CONFIRMED    — confirmado em conta (cartão depois de receber)
 *   PAYMENT_OVERDUE      — venceu sem pagar
 *   PAYMENT_REFUNDED     — estornado
 *   PAYMENT_DELETED      — cancelado
 */
export async function handlePaymentWebhook(payload: {
  event: string;
  payment?: { id: string; status: string; value?: number };
}): Promise<{ processed: boolean; reason?: string }> {
  const asaasPaymentId = payload.payment?.id;
  if (!asaasPaymentId) {
    return { processed: false, reason: "Payload sem payment.id" };
  }

  const local = await prisma.onlinePayment.findUnique({
    where: { asaasPaymentId },
    include: { sale: { include: { customer: true } } },
  });
  if (!local) {
    // Pode ser uma cobrança criada fora do nosso sistema — ignora.
    return { processed: false, reason: "Payment não encontrado localmente" };
  }

  const newStatus = mapAsaasStatus(payload.payment?.status ?? "");
  const isReceivedNow =
    (newStatus === "RECEIVED" || newStatus === "CONFIRMED") &&
    local.status !== "RECEIVED" &&
    local.status !== "CONFIRMED";

  // Atualiza estado local sempre (mesmo se não mudou — atualiza lastEventRaw)
  await prisma.onlinePayment.update({
    where: { id: local.id },
    data: {
      status: newStatus,
      paidAt: isReceivedNow ? new Date() : local.paidAt,
      lastEventRaw: payload as unknown as Prisma.InputJsonValue,
    },
  });

  // Marca Sale como CONCLUIDA quando pagamento entra
  if (isReceivedNow) {
    if (local.sale.status === SaleStatus.ABERTA) {
      await prisma.sale.update({
        where: { id: local.saleId },
        data: {
          status: SaleStatus.CONCLUIDA,
          closedAt: new Date(),
        },
      });
    }

    // Dispara WhatsApp pro cliente avisando que recebemos
    if (local.sale.customer?.phone) {
      sendText({
        phone: local.sale.customer.phone,
        message: `✅ *Pagamento recebido!*\n\nPedido #${local.sale.number} — pagamento confirmado pela Casa Roxa. Já estamos preparando seu pedido. 🍗`,
        event: "PAYMENT_RECEIVED",
        toggleField: "whatsappNotifyPaymentReceived",
        customerId: local.sale.customerId,
        saleId: local.saleId,
      }).catch((e) =>
        console.error("[payment-webhook] whatsapp:", e),
      );
    }
  }

  return { processed: true };
}
