/**
 * Orquestração de pagamento online (Asaas) — entre o checkout público
 * da Casa Roxa e o gateway.
 *
 * Suporta dois tipos de "subject" pra cobrança:
 *  - Sale (pedido do cardápio) — PIX ou CREDIT_CARD
 *  - RaffleEntry (ticket de sorteio pago) — só PIX
 *
 * Fluxo:
 *   1. Cliente termina checkout ou compra ticket de rifa.
 *   2. initiateOnlinePayment({saleId|raffleEntryId, billingType}):
 *      - garante que o Customer da Casa Roxa tem asaasCustomerId (cria se não)
 *      - cria Payment no Asaas com vencimento +N horas
 *      - PIX: pega QR code + payload; CREDIT_CARD: usa invoiceUrl
 *      - cria OnlinePayment local com status PENDING
 *   3. Cliente paga.
 *   4. Asaas dispara webhook → handlePaymentWebhook atualiza status:
 *      - Sale: marca CONCLUIDA + WhatsApp "pagamento recebido"
 *      - RaffleEntry: marca confirmed=true + WhatsApp com número
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
  confirmRaffleEntryFromPayment,
  releasePendingRaffleEntry,
} from "./raffle.service";

const DEFAULT_TTL_HOURS = 24;

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

  if (cpfCnpjOverride && cpfCnpjOverride !== customer.cpfCnpj) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { cpfCnpj: cpfCnpjOverride },
    });
  }

  if (customer.asaasCustomerId) {
    if (!customer.cpfCnpj) {
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
  paymentId: string;
  billingType: OnlinePaymentBillingType;
  status: OnlinePaymentStatus;
  pixPayload?: string | null;
  pixQrCodeBase64?: string | null;
  invoiceUrl?: string | null;
  value: number;
  dueDate: Date;
};

type InitiateInput = {
  billingType: OnlinePaymentBillingType;
  cpfCnpj?: string;
} & ({ saleId: string; raffleEntryId?: never } | { saleId?: never; raffleEntryId: string });

/**
 * Inicia (ou retorna existente) o OnlinePayment de uma Sale ou RaffleEntry.
 * Idempotente — chamar 2x retorna o mesmo registro.
 */
export async function initiateOnlinePayment(
  input: InitiateInput,
): Promise<InitiateOnlinePaymentResult> {
  if (!isAsaasConfigured()) {
    throw new BusinessError(
      "Pagamento online não configurado. Avise o administrador da Casa Roxa.",
    );
  }

  // Resolve o "subject" — extrai customerId, valor, descrição, idempotência.
  const subject = await resolveSubject(input);

  // Já tem payment associado? Retorna idempotente.
  if (subject.existingPayment) {
    const p = subject.existingPayment;
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

  const { asaasCustomerId } = await getOrCreateAsaasCustomer(
    subject.customerId,
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
    value: subject.value,
    dueDate,
    description: subject.description,
    externalReference: subject.externalReference,
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
      saleId: input.saleId ?? null,
      raffleEntryId: input.raffleEntryId ?? null,
      asaasPaymentId: asaasPayment.id,
      asaasCustomerId,
      billingType: input.billingType,
      value: subject.value,
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

type ResolvedSubject = {
  customerId: string;
  value: number;
  description: string;
  externalReference: string;
  existingPayment: Awaited<ReturnType<typeof prisma.onlinePayment.findFirst>> | null;
};

async function resolveSubject(input: InitiateInput): Promise<ResolvedSubject> {
  if (input.saleId) {
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
    if (!sale.customerId) {
      throw new BusinessError(
        "Pedido sem cliente identificado. Identifique-se pelo WhatsApp primeiro.",
      );
    }
    const value = Number(sale.totalRevenue) - Number(sale.couponDiscount);
    if (value <= 0) {
      throw new BusinessError("Valor do pedido inválido pra cobrança online.");
    }
    return {
      customerId: sale.customerId,
      value,
      description: `Casa Roxa — Pedido #${sale.number}`,
      externalReference: sale.id,
      existingPayment: sale.onlinePayment,
    };
  }

  // raffleEntryId
  const entry = await prisma.raffleEntry.findUnique({
    where: { id: input.raffleEntryId! },
    include: {
      raffle: true,
      onlinePayment: true,
    },
  });
  if (!entry) throw new BusinessError("Inscrição de sorteio não encontrada.");
  if (entry.confirmed) {
    throw new BusinessError("Esta inscrição já foi confirmada.");
  }
  if (entry.raffle.ticketPriceCents <= 0) {
    throw new BusinessError("Este sorteio é gratuito — não tem cobrança.");
  }
  return {
    customerId: entry.customerId,
    value: entry.raffle.ticketPriceCents / 100,
    description: `Casa Roxa — Sorteio "${entry.raffle.name}" (nº ${entry.number})`,
    externalReference: entry.id,
    existingPayment: entry.onlinePayment,
  };
}

// ---------- Consulta ----------

export async function getOnlinePaymentBySaleId(saleId: string) {
  return prisma.onlinePayment.findUnique({ where: { saleId } });
}

export async function getOnlinePaymentByRaffleEntryId(raffleEntryId: string) {
  return prisma.onlinePayment.findUnique({ where: { raffleEntryId } });
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
      raffleEntry: {
        include: {
          customer: true,
          raffle: { select: { name: true } },
        },
      },
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
          message: `✅ *Pagamento recebido!*\n\nPedido #${local.sale.number} — pagamento confirmado pela Casa Roxa. Já estamos preparando seu pedido. 🍗`,
          event: "PAYMENT_RECEIVED",
          toggleField: "whatsappNotifyPaymentReceived",
          customerId: local.sale.customerId,
          saleId: local.sale.id,
        }).catch((e) => console.error("[payment-webhook] whatsapp:", e));
      }
    } else if (local.raffleEntry) {
      await confirmRaffleEntryFromPayment(local.raffleEntry.id);
    }
  } else if (isExpiredNow && local.raffleEntry && !local.raffleEntry.confirmed) {
    // Pagamento de rifa expirou sem pagar — libera o número.
    await releasePendingRaffleEntry(local.raffleEntry.id);
  }

  return { processed: true };
}
