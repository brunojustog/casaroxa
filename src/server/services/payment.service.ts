/**
 * Orquestração de pagamento online (Asaas).
 *
 * Subjects suportados:
 *  - Sale (pedido) — PIX ou CREDIT_CARD
 *  - "Rifa cesta"  — N RaffleEntries reservadas de uma vez (1 PIX só)
 *
 * Fluxo de rifa:
 *   1. raffle.service.reserveRaffleNumbersForPurchase cria N entries
 *      confirmed=false retornando entryIds + totalCents.
 *   2. payment.service.initiateOnlinePayment({ raffleEntryIds, raffleId,
 *      customerId, valueCents }) cria 1 OnlinePayment + linka as entries
 *      via RaffleEntry.onlinePaymentId.
 *   3. Webhook PAYMENT_RECEIVED → confirmRaffleEntriesFromPayment marca
 *      todas confirmed=true + WhatsApp.
 *   4. Webhook OVERDUE/CANCELLED → releasePendingRaffleEntries deleta as
 *      pendentes (libera os números).
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
import {
  confirmRaffleEntriesFromPayment,
  releasePendingRaffleEntries,
} from "./raffle.service";
import { isValidCpfOrCnpj } from "@/lib/cpf-cnpj";

/** Erro vindo do Asaas significa que o CPF/CNPJ é ruim de verdade. */
function isAsaasCpfError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("cpf") || m.includes("cnpj");
}

const DEFAULT_TTL_HOURS = 24;
/** Asaas exige R$ 5,00 mínimo por cobrança (PIX ou cartão). */
const ASAAS_MIN_VALUE_CENTS = 500;

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

  const cpfCnpj = cpfCnpjOverride ?? customer.cpfCnpj;
  if (!cpfCnpj) {
    throw new NeedCpfError();
  }
  // Valida DV antes de mandar pro Asaas. Se o que está salvo no DB é
  // inválido, limpa e pede de novo.
  if (!isValidCpfOrCnpj(cpfCnpj)) {
    if (customer.cpfCnpj) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { cpfCnpj: null },
      });
    }
    throw new NeedCpfError();
  }

  if (cpfCnpjOverride && cpfCnpjOverride !== customer.cpfCnpj) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { cpfCnpj: cpfCnpjOverride },
    });
  }

  if (customer.asaasCustomerId) {
    const updated = await updateAsaasCustomer(customer.asaasCustomerId, {
      cpfCnpj,
      phone: customer.phone,
      email: customer.email,
    });
    if (!updated.ok) {
      // Asaas reclamou de CPF/CNPJ — limpa e pede novamente
      if (isAsaasCpfError(updated.error)) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { cpfCnpj: null },
        });
        throw new NeedCpfError();
      }
      throw new BusinessError(
        `Falha ao atualizar cliente no Asaas: ${updated.error}`,
      );
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
    if (isAsaasCpfError(created.error)) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { cpfCnpj: null },
      });
      throw new NeedCpfError();
    }
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
  paymentId: string;
  billingType: OnlinePaymentBillingType;
  status: OnlinePaymentStatus;
  pixPayload?: string | null;
  pixQrCodeBase64?: string | null;
  invoiceUrl?: string | null;
  value: number;
  dueDate: Date;
};

type InitiateInput =
  | {
      kind: "sale";
      saleId: string;
      billingType: OnlinePaymentBillingType;
      cpfCnpj?: string;
    }
  | {
      kind: "raffle";
      raffleId: string;
      customerId: string;
      entryIds: string[];
      valueCents: number;
      description: string;
      cpfCnpj?: string;
    };

export async function initiateOnlinePayment(
  input: InitiateInput,
): Promise<InitiateOnlinePaymentResult> {
  if (!isAsaasConfigured()) {
    throw new BusinessError(
      "Pagamento online não configurado. Avise o administrador da Casa Roxa.",
    );
  }
  if (input.kind === "sale") {
    return initiateSalePayment(input);
  }
  return initiateRafflePayment(input);
}

async function initiateSalePayment(input: {
  saleId: string;
  billingType: OnlinePaymentBillingType;
  cpfCnpj?: string;
}): Promise<InitiateOnlinePaymentResult> {
  const sale = await prisma.sale.findUnique({
    where: { id: input.saleId },
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
  const value = Number(sale.totalRevenue) - Number(sale.couponDiscount);
  if (value <= 0) {
    throw new BusinessError("Valor do pedido inválido pra cobrança online.");
  }
  if (value * 100 < ASAAS_MIN_VALUE_CENTS) {
    throw new BusinessError(
      "Valor mínimo de cobrança é R$ 5,00 (regra do banco).",
    );
  }

  const { asaasCustomerId } = await getOrCreateAsaasCustomer(
    sale.customerId,
    input.cpfCnpj,
  );

  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { asaasPaymentTtlHours: true },
  });
  const ttlHours = settings?.asaasPaymentTtlHours ?? DEFAULT_TTL_HOURS;
  const dueDate = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const asaasResult = await createAsaasPayment({
    customerId: asaasCustomerId,
    billingType: input.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX",
    value,
    dueDate,
    description: `Casa Roxa — Pedido #${sale.number}`,
    externalReference: sale.id,
  });
  if (!asaasResult.ok) {
    throw new BusinessError(`Falha no Asaas: ${asaasResult.error}`);
  }
  const asaasPayment = asaasResult.payment;

  let pixPayload: string | null = null;
  let pixQrCodeBase64: string | null = null;
  if (input.billingType === "PIX") {
    const qr = await getAsaasPixQrCode(asaasPayment.id);
    if (qr.ok) {
      pixPayload = qr.qr.payload;
      pixQrCodeBase64 = qr.qr.encodedImage;
    }
  }

  const created = await prisma.onlinePayment.create({
    data: {
      saleId: sale.id,
      customerId: sale.customerId,
      asaasPaymentId: asaasPayment.id,
      asaasCustomerId,
      billingType: input.billingType,
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

async function initiateRafflePayment(input: {
  raffleId: string;
  customerId: string;
  entryIds: string[];
  valueCents: number;
  description: string;
  cpfCnpj?: string;
}): Promise<InitiateOnlinePaymentResult> {
  // Rifa = sempre PIX. Recupera a "cesta" pra confirmar consistência.
  const entries = await prisma.raffleEntry.findMany({
    where: { id: { in: input.entryIds } },
    select: {
      id: true,
      number: true,
      confirmed: true,
      raffleId: true,
      customerId: true,
      onlinePaymentId: true,
    },
  });
  if (entries.length !== input.entryIds.length) {
    throw new BusinessError("Algum número da cesta não existe mais.");
  }
  if (entries.some((e) => e.raffleId !== input.raffleId)) {
    throw new BusinessError("Cesta tem números de rifas diferentes.");
  }
  if (entries.some((e) => e.customerId !== input.customerId)) {
    throw new BusinessError("Cesta tem números de clientes diferentes.");
  }
  if (entries.some((e) => e.confirmed)) {
    throw new BusinessError("Algum número já foi confirmado.");
  }

  // Asaas exige R$ 5 mínimo. Avisa cliente quantos números precisa.
  if (input.valueCents < ASAAS_MIN_VALUE_CENTS) {
    throw new BusinessError(
      `Valor mínimo de cobrança é R$ 5,00 (regra do banco). Selecione mais números pra completar.`,
    );
  }

  // Se TODOS já têm o mesmo payment vinculado, retorna idempotente.
  const allPaymentIds = new Set(entries.map((e) => e.onlinePaymentId));
  if (allPaymentIds.size === 1 && entries[0].onlinePaymentId) {
    const existing = await prisma.onlinePayment.findUnique({
      where: { id: entries[0].onlinePaymentId },
    });
    if (existing) {
      return {
        paymentId: existing.id,
        billingType: existing.billingType,
        status: existing.status,
        pixPayload: existing.pixPayload,
        pixQrCodeBase64: existing.pixQrCodeBase64,
        invoiceUrl: existing.invoiceUrl,
        value: Number(existing.value),
        dueDate: existing.dueDate,
      };
    }
  }

  const value = input.valueCents / 100;

  const { asaasCustomerId } = await getOrCreateAsaasCustomer(
    input.customerId,
    input.cpfCnpj,
  );

  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { asaasPaymentTtlHours: true },
  });
  const ttlHours = settings?.asaasPaymentTtlHours ?? DEFAULT_TTL_HOURS;
  const dueDate = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const asaasResult = await createAsaasPayment({
    customerId: asaasCustomerId,
    billingType: "PIX",
    value,
    dueDate,
    description: input.description,
    externalReference: `raffle:${input.raffleId}`,
  });
  if (!asaasResult.ok) {
    throw new BusinessError(`Falha no Asaas: ${asaasResult.error}`);
  }
  const asaasPayment = asaasResult.payment;

  let pixPayload: string | null = null;
  let pixQrCodeBase64: string | null = null;
  const qr = await getAsaasPixQrCode(asaasPayment.id);
  if (qr.ok) {
    pixPayload = qr.qr.payload;
    pixQrCodeBase64 = qr.qr.encodedImage;
  }

  // Cria payment e vincula entries dentro de transação
  const created = await prisma.$transaction(async (tx) => {
    const p = await tx.onlinePayment.create({
      data: {
        raffleId: input.raffleId,
        customerId: input.customerId,
        asaasPaymentId: asaasPayment.id,
        asaasCustomerId,
        billingType: "PIX",
        value,
        status: mapAsaasStatus(asaasPayment.status),
        invoiceUrl: asaasPayment.invoiceUrl ?? null,
        pixPayload,
        pixQrCodeBase64,
        dueDate,
      },
    });
    await tx.raffleEntry.updateMany({
      where: { id: { in: input.entryIds } },
      data: { onlinePaymentId: p.id },
    });
    return p;
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

/**
 * Cria charge Asaas pra sinal de encomenda. Idempotente: se já existe
 * OnlinePayment vinculado ao OrderRequest, retorna ele. Sempre PIX.
 *
 * Pré-requisitos:
 *   - OrderRequest tem customerId (cliente cadastrado)
 *   - Customer tem cpfCnpj (Asaas exige)
 *   - depositRequiredCents >= ASAAS_MIN_VALUE_CENTS (R$ 5,00)
 */
export async function initiateOrderRequestDepositPayment(input: {
  orderRequestId: string;
  cpfCnpj?: string;
}): Promise<InitiateOnlinePaymentResult> {
  const req = await prisma.orderRequest.findUnique({
    where: { id: input.orderRequestId },
    select: {
      id: true,
      number: true,
      customerId: true,
      depositRequiredCents: true,
      depositPaidAt: true,
    },
  });
  if (!req) throw new BusinessError("Encomenda não encontrada.");
  if (!req.depositRequiredCents || req.depositRequiredCents <= 0) {
    throw new BusinessError("Encomenda sem sinal configurado.");
  }
  if (req.depositPaidAt) {
    throw new BusinessError("Sinal já foi pago.");
  }
  if (!req.customerId) {
    throw new BusinessError(
      "Cliente não está cadastrado — não dá pra gerar cobrança online.",
    );
  }
  if (req.depositRequiredCents < ASAAS_MIN_VALUE_CENTS) {
    throw new BusinessError(
      "Valor mínimo de cobrança é R$ 5,00 (regra do banco).",
    );
  }

  // Idempotência: se já existe payment, retorna
  const existing = await prisma.onlinePayment.findUnique({
    where: { orderRequestId: req.id },
  });
  if (existing) {
    return {
      paymentId: existing.id,
      billingType: existing.billingType,
      status: existing.status,
      pixPayload: existing.pixPayload,
      pixQrCodeBase64: existing.pixQrCodeBase64,
      invoiceUrl: existing.invoiceUrl,
      value: Number(existing.value),
      dueDate: existing.dueDate,
    };
  }

  const value = req.depositRequiredCents / 100;

  const { asaasCustomerId } = await getOrCreateAsaasCustomer(
    req.customerId,
    input.cpfCnpj,
  );

  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { asaasPaymentTtlHours: true },
  });
  const ttlHours = settings?.asaasPaymentTtlHours ?? DEFAULT_TTL_HOURS;
  const dueDate = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const asaasResult = await createAsaasPayment({
    customerId: asaasCustomerId,
    billingType: "PIX",
    value,
    dueDate,
    description: `Casa Roxa — Sinal encomenda ER-${req.number}`,
    externalReference: `orderRequest:${req.id}`,
  });
  if (!asaasResult.ok) {
    throw new BusinessError(`Falha no Asaas: ${asaasResult.error}`);
  }
  const asaasPayment = asaasResult.payment;

  let pixPayload: string | null = null;
  let pixQrCodeBase64: string | null = null;
  const qr = await getAsaasPixQrCode(asaasPayment.id);
  if (qr.ok) {
    pixPayload = qr.qr.payload;
    pixQrCodeBase64 = qr.qr.encodedImage;
  }

  const created = await prisma.onlinePayment.create({
    data: {
      orderRequestId: req.id,
      customerId: req.customerId,
      asaasPaymentId: asaasPayment.id,
      asaasCustomerId,
      billingType: "PIX",
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

// ---------- Consulta ----------

export async function getOnlinePaymentBySaleId(saleId: string) {
  return prisma.onlinePayment.findUnique({ where: { saleId } });
}

export async function getOnlinePaymentById(paymentId: string) {
  return prisma.onlinePayment.findUnique({ where: { id: paymentId } });
}

// ---------- Webhook handler ----------

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
    include: {
      sale: { include: { customer: true } },
      raffleEntries: { select: { id: true, confirmed: true } },
      orderRequest: { select: { id: true, number: true, customerName: true, customerPhone: true } },
    },
  });
  if (!local) {
    return { processed: false, reason: "Payment não encontrado localmente" };
  }

  const newStatus = mapAsaasStatus(payload.payment?.status ?? "");
  const wasReceived =
    local.status === "RECEIVED" || local.status === "CONFIRMED";
  const isReceivedNow =
    (newStatus === "RECEIVED" || newStatus === "CONFIRMED") && !wasReceived;
  const isExpiredNow =
    (newStatus === "OVERDUE" || newStatus === "CANCELLED") &&
    local.status !== "OVERDUE" &&
    local.status !== "CANCELLED";

  await prisma.onlinePayment.update({
    where: { id: local.id },
    data: {
      status: newStatus,
      paidAt: isReceivedNow ? new Date() : local.paidAt,
      lastEventRaw: payload as unknown as Prisma.InputJsonValue,
    },
  });

  if (isReceivedNow) {
    if (local.sale) {
      if (local.sale.status === SaleStatus.ABERTA) {
        await prisma.sale.update({
          where: { id: local.sale.id },
          data: {
            status: SaleStatus.CONCLUIDA,
            closedAt: new Date(),
          },
        });
      }
      if (local.sale.customer?.phone) {
        sendText({
          phone: local.sale.customer.phone,
          message: `✅ *Pagamento recebido!*\n\nPedido #${local.sale.number} — pagamento confirmado pela Casa Roxa. Já estamos preparando seu pedido. 🍗\n\nComprovante: https://casaroxa.com.br/pedido/${local.sale.id}/comprovante`,
          event: "PAYMENT_RECEIVED",
          toggleField: "whatsappNotifyPaymentReceived",
          customerId: local.sale.customerId,
          saleId: local.sale.id,
        }).catch((e) => console.error("[payment-webhook] whatsapp:", e));
      }
    } else if (local.raffleId && local.raffleEntries.length > 0) {
      await confirmRaffleEntriesFromPayment(local.id);
    } else if (local.orderRequest) {
      // Marca sinal como pago
      await prisma.orderRequest.update({
        where: { id: local.orderRequest.id },
        data: { depositPaidAt: new Date() },
      });
      // Notifica o cliente
      sendText({
        phone: local.orderRequest.customerPhone,
        message: `✅ *Sinal recebido!*\n\nObrigado, ${local.orderRequest.customerName.split(/\s+/)[0]}! Confirmamos o sinal da encomenda ER-${local.orderRequest.number}. Já estamos planejando a produção.`,
        event: "PAYMENT_RECEIVED",
        toggleField: "whatsappNotifyPaymentReceived",
      }).catch((e) =>
        console.error("[payment-webhook order-request] whatsapp:", e),
      );
    }
  } else if (isExpiredNow && local.raffleId) {
    await releasePendingRaffleEntries(local.id);
  }

  return { processed: true };
}
