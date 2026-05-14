/**
 * NPS pós-entrega (Sprint 6).
 *
 * Fluxo:
 *   1. Admin clica "Enviar avaliação" em uma Sale CONCLUIDA/ENTREGUE.
 *   2. sendNpsRequest gera token único na Sale + manda WhatsApp com link.
 *   3. Cliente abre /avaliacao/[token], escolhe nota 0-10 + comentário.
 *   4. submitReview cria CustomerReview, calcula categoria.
 *   5. Admin vê em /avaliacoes, pode anotar e atribuir cupom de follow-up.
 */
import { randomBytes } from "node:crypto";
import { NpsCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { sendText } from "./whatsapp.service";

function generateToken(): string {
  return randomBytes(16).toString("hex");
}

export function categoryFromScore(score: number): NpsCategory {
  if (score >= 9) return "PROMOTER";
  if (score >= 7) return "PASSIVE";
  return "DETRACTOR";
}

// ---------- Envio do pedido de avaliação ----------

export async function sendNpsRequest(
  saleId: string,
): Promise<{ token: string; whatsappStatus: string }> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      number: true,
      status: true,
      customerName: true,
      customer: { select: { phone: true, id: true } },
      notes: true,
      npsToken: true,
    },
  });
  if (!sale) throw new BusinessError("Pedido não encontrado.");
  if (sale.status === "CANCELADA") {
    throw new BusinessError("Não dá pra avaliar pedido cancelado.");
  }

  // Telefone: prefere Customer.phone; senão tenta extrair de notes (vendas
  // que vieram de fluxos antigos sem customerId podem ter só notes).
  const phone = sale.customer?.phone;
  if (!phone) {
    throw new BusinessError(
      "Pedido sem telefone cadastrado — não dá pra enviar avaliação automática.",
    );
  }

  // Gera token (idempotente: se já tem, reutiliza)
  const token = sale.npsToken ?? generateToken();
  await prisma.sale.update({
    where: { id: saleId },
    data: { npsToken: token, npsSentAt: new Date() },
  });

  const publicDomain = process.env.PUBLIC_DOMAIN;
  const link = publicDomain
    ? `https://${publicDomain}/avaliacao/${token}`
    : `/avaliacao/${token}`;

  const message = [
    `Oi, ${sale.customerName?.split(/\s+/)[0] ?? "tudo bem"}? 👋`,
    ``,
    `Aqui é da Casa Roxa. Como foi seu pedido #${sale.number}?`,
    `Sua opinião conta MUITO pra gente melhorar:`,
    ``,
    link,
    ``,
    `Leva 30 segundos. Obrigado!`,
  ].join("\n");

  const result = await sendText({
    phone,
    message,
    event: "NPS_REQUEST",
    toggleField: "whatsappNotifyNpsRequest",
    customerId: sale.customer?.id ?? null,
    saleId: sale.id,
  });

  return { token, whatsappStatus: result.status };
}

// ---------- Recebimento da review (público, sem auth) ----------

/** Lê dados públicos da Sale pelo token — pra mostrar resumo na página. */
export async function getReviewInviteByToken(token: string) {
  return prisma.sale.findUnique({
    where: { npsToken: token },
    select: {
      id: true,
      number: true,
      customerName: true,
      occurredAt: true,
      status: true,
      review: { select: { id: true, score: true, comment: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          product: { select: { name: true } },
          combo: { select: { name: true } },
        },
      },
    },
  });
}

export async function submitReview(input: {
  token: string;
  score: number;
  comment: string | null;
}): Promise<{ reviewId: string; category: NpsCategory }> {
  if (input.score < 0 || input.score > 10 || !Number.isInteger(input.score)) {
    throw new BusinessError("Nota inválida — use de 0 a 10.");
  }
  const sale = await prisma.sale.findUnique({
    where: { npsToken: input.token },
    select: {
      id: true,
      customerId: true,
      customerName: true,
      customer: { select: { phone: true } },
      review: { select: { id: true } },
    },
  });
  if (!sale) throw new BusinessError("Avaliação não encontrada.");
  if (sale.review) {
    throw new BusinessError("Este pedido já foi avaliado. Obrigado!");
  }

  const category = categoryFromScore(input.score);
  const review = await prisma.customerReview.create({
    data: {
      saleId: sale.id,
      customerId: sale.customerId,
      customerName: sale.customerName ?? "Cliente",
      customerPhone: sale.customer?.phone ?? null,
      score: input.score,
      category,
      comment: input.comment ?? null,
    },
    select: { id: true },
  });

  return { reviewId: review.id, category };
}

// ---------- Listagem / leitura admin ----------

export async function listReviews(filters: {
  category?: NpsCategory | "all";
}) {
  const where: Prisma.CustomerReviewWhereInput = {};
  if (filters.category && filters.category !== "all") {
    where.category = filters.category;
  }
  return prisma.customerReview.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      sale: {
        select: {
          id: true,
          number: true,
          totalRevenue: true,
          couponDiscount: true,
        },
      },
      followupCoupon: { select: { id: true, code: true } },
    },
  });
}

export async function getReviewById(id: string) {
  return prisma.customerReview.findUnique({
    where: { id },
    include: {
      sale: {
        select: {
          id: true,
          number: true,
          occurredAt: true,
          totalRevenue: true,
          couponDiscount: true,
          notes: true,
        },
      },
      customer: { select: { id: true, name: true, phone: true } },
      followupCoupon: {
        select: { id: true, code: true, type: true, value: true },
      },
    },
  });
}

export async function updateReviewAdmin(
  id: string,
  input: { adminNotes?: string | null; followupCouponId?: string | null },
) {
  return prisma.customerReview.update({
    where: { id },
    data: {
      adminNotes: input.adminNotes,
      followupCouponId: input.followupCouponId,
    },
    select: { id: true },
  });
}

// ---------- Métricas ----------

/** Calcula NPS clássico: %Promoters - %Detractors sobre N reviews. */
export async function getNpsScore(): Promise<{
  totalReviews: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number;
}> {
  const reviews = await prisma.customerReview.findMany({
    select: { category: true },
  });
  const totalReviews = reviews.length;
  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      nps: 0,
    };
  }
  const promoters = reviews.filter((r) => r.category === "PROMOTER").length;
  const passives = reviews.filter((r) => r.category === "PASSIVE").length;
  const detractors = reviews.filter((r) => r.category === "DETRACTOR").length;
  const nps = Math.round(
    ((promoters - detractors) / totalReviews) * 100,
  );
  return { totalReviews, promoters, passives, detractors, nps };
}
