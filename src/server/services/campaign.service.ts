/**
 * Campanhas (Sprint 5).
 *
 * Admin define mensagem + escolhe audiência fixa + opcionalmente cria
 * cupom pra atribuição. Disparo é manual (botão "Disparar agora") com
 * rate limit conservador pra não tomar ban do WhatsApp (10s entre msgs).
 *
 * Atribuição automática: quando o cliente usa o cupom da campanha no
 * checkout, ao concluir/pagar é criada uma CampaignOrderAttribution.
 */
import {
  CampaignAudienceKey,
  CampaignDeliveryStatus,
  CampaignStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { listCustomersForAudience } from "./audience.service";
import { sendText } from "./whatsapp.service";

const RATE_LIMIT_MS = 10_000; // 10s entre mensagens (não estourar wuzapi/WhatsApp)

// ---------- Listagem / leitura ----------

export async function listCampaigns(filters: { status?: CampaignStatus | "all" }) {
  const where: Prisma.CampaignWhereInput = {};
  if (filters.status && filters.status !== "all") where.status = filters.status;
  return prisma.campaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      coupon: { select: { id: true, code: true } },
      _count: {
        select: {
          deliveries: true,
          attributions: true,
        },
      },
    },
  });
}

export async function getCampaignById(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: {
      coupon: { select: { id: true, code: true, value: true, type: true } },
      createdBy: { select: { id: true, name: true } },
      _count: {
        select: {
          deliveries: true,
          attributions: true,
        },
      },
    },
  });
}

export async function getCampaignWithDeliveries(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: {
      coupon: { select: { id: true, code: true, value: true, type: true } },
      createdBy: { select: { id: true, name: true } },
      deliveries: {
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      attributions: {
        include: {
          sale: {
            select: {
              id: true,
              number: true,
              totalRevenue: true,
              couponDiscount: true,
              occurredAt: true,
              customerName: true,
            },
          },
        },
      },
    },
  });
}

// ---------- Criação / edição ----------

export async function createCampaign(
  input: {
    name: string;
    message: string;
    audienceKey: CampaignAudienceKey;
    couponCode?: string | null;
    couponType?: "PERCENT" | "FIXED";
    couponValue?: number;
    couponMaxUses?: number | null;
    couponValidDays?: number;
  },
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    // Cria cupom (opcional)
    let couponId: string | null = null;
    if (input.couponCode && input.couponType && input.couponValue) {
      const code = input.couponCode.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
        throw new BusinessError(
          "Código do cupom: 3-30 caracteres, letras, números, _ e -.",
        );
      }
      const validUntil = new Date(
        Date.now() + (input.couponValidDays ?? 30) * 24 * 60 * 60 * 1000,
      );
      const coupon = await tx.coupon.create({
        data: {
          code,
          description: `Campanha: ${input.name}`,
          type: input.couponType,
          value: input.couponValue.toString(),
          maxUses: input.couponMaxUses ?? null,
          validUntil,
        },
        select: { id: true },
      });
      couponId = coupon.id;
    }

    return tx.campaign.create({
      data: {
        name: input.name,
        message: input.message,
        audienceKey: input.audienceKey,
        couponId,
        createdById: userId,
        status: "DRAFT",
      },
      select: { id: true },
    });
  });
}

export async function deleteCampaign(id: string) {
  const c = await prisma.campaign.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!c) throw new BusinessError("Campanha não encontrada.");
  if (c.status === "DISPATCHING") {
    throw new BusinessError("Campanha em disparo não pode ser excluída.");
  }
  await prisma.campaign.delete({ where: { id } });
}

// ---------- Preview da audiência ----------

export async function previewAudience(key: CampaignAudienceKey) {
  return listCustomersForAudience(key);
}

// ---------- Dispatch ----------

/**
 * Renderiza a mensagem substituindo variáveis:
 *   {nome}  → primeiro nome do cliente
 *   {cupom} → código do cupom (se houver)
 */
function renderMessage(
  template: string,
  customer: { name: string },
  couponCode?: string | null,
): string {
  const firstName = customer.name.split(/\s+/)[0];
  return template
    .replace(/\{nome\}/gi, firstName)
    .replace(/\{cupom\}/gi, couponCode ?? "");
}

/**
 * Dispara a campanha: pega audiência atual, cria deliveries, envia 1 a 1
 * respeitando RATE_LIMIT_MS. Atualiza status pra DISPATCHING durante
 * e SENT no fim. Idempotente: se já estiver SENT, recusa; se DRAFT,
 * roda; se DISPATCHING, recusa (anti-double-click).
 */
export async function dispatchCampaign(id: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { coupon: { select: { code: true } } },
  });
  if (!campaign) throw new BusinessError("Campanha não encontrada.");
  if (campaign.status !== "DRAFT") {
    throw new BusinessError(
      `Campanha já está em status ${campaign.status} — só DRAFT pode disparar.`,
    );
  }

  // Resolve audiência agora (snapshot)
  const customers = await listCustomersForAudience(campaign.audienceKey);
  if (customers.length === 0) {
    await prisma.campaign.update({
      where: { id },
      data: {
        status: "SENT",
        audienceSnapshot: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // Marca DISPATCHING + cria deliveries PENDING
  await prisma.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id },
      data: {
        status: "DISPATCHING",
        audienceSnapshot: customers.length,
        startedAt: new Date(),
      },
    });
    for (const c of customers) {
      await tx.campaignDelivery.upsert({
        where: {
          campaignId_customerId: { campaignId: id, customerId: c.id },
        },
        update: {},
        create: {
          campaignId: id,
          customerId: c.id,
          phoneSnapshot: c.phone,
        },
      });
    }
  });

  // Envia 1 a 1 com rate limit
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const couponCode = campaign.coupon?.code ?? null;

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const message = renderMessage(campaign.message, c, couponCode);

    const result = await sendText({
      phone: c.phone,
      message,
      event: "MANUAL",
      customerId: c.id,
    });

    let newStatus: CampaignDeliveryStatus;
    if (result.status === "SENT") {
      newStatus = "SENT";
      sent++;
    } else if (result.status === "FAILED") {
      newStatus = "FAILED";
      failed++;
    } else {
      newStatus = "SKIPPED";
      skipped++;
    }

    await prisma.campaignDelivery.update({
      where: {
        campaignId_customerId: { campaignId: id, customerId: c.id },
      },
      data: {
        status: newStatus,
        messageSnapshot: message,
        whatsappLogId: result.logId,
        errorMessage:
          result.status === "FAILED"
            ? result.error
            : result.status === "SKIPPED"
              ? result.reason
              : null,
        sentAt: result.status === "SENT" ? new Date() : null,
      },
    });

    // Rate limit (não dorme depois do último)
    if (i < customers.length - 1) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }
  }

  await prisma.campaign.update({
    where: { id },
    data: { status: "SENT", finishedAt: new Date() },
  });

  return { sent, failed, skipped };
}

/**
 * Cria CampaignOrderAttribution se a Sale usou um cupom de campanha.
 * Chamado do public-order.service no momento do checkout.
 *
 * Idempotente: se já existe attribution pra essa Sale, retorna silenciosamente.
 */
export async function attributeSaleToCampaign(
  tx: Prisma.TransactionClient,
  saleId: string,
  couponId: string,
): Promise<void> {
  const campaign = await tx.campaign.findFirst({
    where: { couponId },
    select: { id: true },
  });
  if (!campaign) return;
  await tx.campaignOrderAttribution.upsert({
    where: { saleId },
    update: {},
    create: {
      campaignId: campaign.id,
      saleId,
    },
  });
}
