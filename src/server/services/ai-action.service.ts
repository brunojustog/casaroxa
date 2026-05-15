/**
 * IA com aprovação humana (Sprint 9).
 *
 * Fluxo:
 *   1. IA (ou admin direto) chama proposeAction(kind, payload) → cria
 *      AiActionApproval PENDING com TTL de 24h.
 *   2. Admin vê em /aprovacoes-ia, aprova ou rejeita.
 *   3. approveAction executa o payload conforme o kind, marca EXECUTED
 *      (ou FAILED se a execução falhou).
 *   4. Cron de expiração marca PENDING > 24h como EXPIRED.
 *
 * Cada kind tem seu executor isolado e idempotência por status (não
 * executa de novo se já EXECUTED).
 */
import { AiActionKind, AiActionStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";

const TTL_HOURS = 24;

// ---------- Schemas dos payloads por kind ----------

const createCouponPayload = z.object({
  code: z.string().trim().min(3).max(30).toUpperCase(),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().positive(),
  maxUses: z.number().int().positive().nullable().optional(),
  validDays: z.number().int().positive().max(365).default(30),
  minOrderAmount: z.number().nonnegative().nullable().optional(),
});

const updateProductPricePayload = z.object({
  productId: z.string().min(1),
  newPrice: z.number().positive(),
  reason: z.string().trim().max(500).nullable().optional(),
});

const sendWhatsappPayload = z.object({
  customerId: z.string().min(1),
  message: z.string().trim().min(1).max(2000),
});

const dispatchCampaignPayload = z.object({
  campaignId: z.string().min(1),
});

function validatePayload(kind: AiActionKind, raw: unknown): unknown {
  switch (kind) {
    case "CREATE_COUPON":
      return createCouponPayload.parse(raw);
    case "UPDATE_PRODUCT_PRICE":
      return updateProductPricePayload.parse(raw);
    case "SEND_WHATSAPP_CUSTOMER":
      return sendWhatsappPayload.parse(raw);
    case "DISPATCH_CAMPAIGN":
      return dispatchCampaignPayload.parse(raw);
  }
}

// ---------- Propose ----------

export async function proposeAction(input: {
  kind: AiActionKind;
  summary: string;
  reasoning?: string | null;
  payload: unknown;
  conversationId?: string | null;
  messageId?: string | null;
}): Promise<{ id: string }> {
  const validated = validatePayload(input.kind, input.payload);
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);
  const created = await prisma.aiActionApproval.create({
    data: {
      kind: input.kind,
      summary: input.summary,
      reasoning: input.reasoning ?? null,
      payload: validated as Prisma.InputJsonValue,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      expiresAt,
    },
    select: { id: true },
  });
  return created;
}

// ---------- List / get ----------

export async function listActions(filters: {
  status?: AiActionStatus | "all";
}) {
  const where: Prisma.AiActionApprovalWhereInput = {};
  if (filters.status && filters.status !== "all") where.status = filters.status;
  return prisma.aiActionApproval.findMany({
    where,
    orderBy: [{ status: "asc" }, { proposedAt: "desc" }],
    take: 100,
    include: {
      decidedBy: { select: { id: true, name: true } },
    },
  });
}

export async function getActionById(id: string) {
  return prisma.aiActionApproval.findUnique({
    where: { id },
    include: {
      decidedBy: { select: { id: true, name: true } },
    },
  });
}

export async function countPending(): Promise<number> {
  return prisma.aiActionApproval.count({ where: { status: "PENDING" } });
}

// ---------- Decide (approve / reject) ----------

export async function rejectAction(id: string, userId: string) {
  const action = await prisma.aiActionApproval.findUnique({ where: { id } });
  if (!action) throw new BusinessError("Ação não encontrada.");
  if (action.status !== "PENDING") {
    throw new BusinessError(
      `Ação está em status ${action.status} — só PENDING pode ser rejeitada.`,
    );
  }
  return prisma.aiActionApproval.update({
    where: { id },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedById: userId,
    },
    select: { id: true },
  });
}

export async function approveAction(id: string, userId: string): Promise<{
  id: string;
  status: AiActionStatus;
  result?: unknown;
}> {
  const action = await prisma.aiActionApproval.findUnique({ where: { id } });
  if (!action) throw new BusinessError("Ação não encontrada.");
  if (action.status !== "PENDING") {
    throw new BusinessError(
      `Ação está em status ${action.status} — só PENDING pode ser aprovada.`,
    );
  }
  if (action.expiresAt < new Date()) {
    await prisma.aiActionApproval.update({
      where: { id },
      data: { status: "EXPIRED" },
    });
    throw new BusinessError("Ação expirou. Crie uma nova proposta.");
  }

  // Marca APPROVED primeiro (rastreável mesmo se executor falhar)
  await prisma.aiActionApproval.update({
    where: { id },
    data: {
      status: "APPROVED",
      decidedAt: new Date(),
      decidedById: userId,
    },
  });

  // Executa
  try {
    const result = await executeAction(action.kind, action.payload);
    await prisma.aiActionApproval.update({
      where: { id },
      data: {
        status: "EXECUTED",
        executedAt: new Date(),
        result: result as Prisma.InputJsonValue,
      },
    });
    return { id, status: "EXECUTED", result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    await prisma.aiActionApproval.update({
      where: { id },
      data: {
        status: "FAILED",
        failureMessage: msg,
      },
    });
    throw new BusinessError(`Aprovada mas falhou ao executar: ${msg}`);
  }
}

// ---------- Executor por kind ----------

async function executeAction(
  kind: AiActionKind,
  payload: Prisma.JsonValue,
): Promise<unknown> {
  switch (kind) {
    case "CREATE_COUPON":
      return executeCreateCoupon(payload);
    case "UPDATE_PRODUCT_PRICE":
      return executeUpdateProductPrice(payload);
    case "SEND_WHATSAPP_CUSTOMER":
      return executeSendWhatsapp(payload);
    case "DISPATCH_CAMPAIGN":
      return executeDispatchCampaign(payload);
  }
}

async function executeCreateCoupon(raw: Prisma.JsonValue) {
  const data = createCouponPayload.parse(raw);
  const validUntil = new Date(
    Date.now() + (data.validDays ?? 30) * 24 * 60 * 60 * 1000,
  );
  const coupon = await prisma.coupon.create({
    data: {
      code: data.code,
      description: "Sugerido pela IA",
      type: data.type,
      value: data.value.toString(),
      maxUses: data.maxUses ?? null,
      minOrderAmount: data.minOrderAmount ?? null,
      validUntil,
    },
    select: { id: true, code: true },
  });
  return coupon;
}

async function executeUpdateProductPrice(raw: Prisma.JsonValue) {
  const data = updateProductPricePayload.parse(raw);
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    select: { id: true, salePrice: true, name: true },
  });
  if (!product) throw new Error("Produto não encontrado.");
  const oldPrice = Number(product.salePrice ?? 0);
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: data.productId },
      data: { salePrice: data.newPrice.toString() },
    });
    await tx.productPriceHistory.create({
      data: {
        productId: data.productId,
        oldPrice: oldPrice.toString(),
        newPrice: data.newPrice.toString(),
      },
    });
  });
  return {
    productId: product.id,
    productName: product.name,
    oldPrice,
    newPrice: data.newPrice,
  };
}

async function executeSendWhatsapp(raw: Prisma.JsonValue) {
  const data = sendWhatsappPayload.parse(raw);
  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
    select: { id: true, phone: true, name: true },
  });
  if (!customer) throw new Error("Cliente não encontrado.");
  const { sendText } = await import("./whatsapp.service");
  const result = await sendText({
    phone: customer.phone,
    message: data.message,
    event: "MANUAL",
    customerId: customer.id,
  });
  if (result.status === "FAILED") {
    throw new Error(`Falha no envio: ${result.error}`);
  }
  return {
    customerId: customer.id,
    customerName: customer.name,
    whatsappStatus: result.status,
    logId: result.logId,
  };
}

async function executeDispatchCampaign(raw: Prisma.JsonValue) {
  const data = dispatchCampaignPayload.parse(raw);
  const campaign = await prisma.campaign.findUnique({
    where: { id: data.campaignId },
    select: { id: true, name: true, status: true },
  });
  if (!campaign) throw new Error("Campanha não encontrada.");
  if (campaign.status !== "DRAFT") {
    throw new Error(`Campanha está em ${campaign.status} — só DRAFT dispara.`);
  }
  const { dispatchCampaign } = await import("./campaign.service");
  const result = await dispatchCampaign(campaign.id);
  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    ...result,
  };
}

// ---------- Cron de expiração ----------

export async function expirePendingActions(): Promise<{ expired: number }> {
  const result = await prisma.aiActionApproval.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  return { expired: result.count };
}
