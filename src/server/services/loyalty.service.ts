/**
 * Cartão fidelidade da Casa Roxa.
 *
 * Regra:
 *   - 1 ponto por R$ 1 gasto em vendas CONCLUIDAS com customerId definido.
 *     Base de cálculo: totalRevenue - couponDiscount (líquido de cupom).
 *   - A cada 100 pontos acumulados, sistema gera automaticamente um
 *     CUPOM FIXED de R$ 10 com código FID_<8chars> válido por 30 dias,
 *     e debita 100 pontos via REDEEM.
 *   - Pontos não expiram.
 *
 * O fluxo de earn é disparado por `applyEarnForSale` chamado dentro da
 * transação de concludeSale (sales.service). Reentrante: detecta venda já
 * processada (verificando LoyaltyTransaction com saleId) e ignora.
 */
import { LoyaltyTransactionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";

const POINTS_PER_REAL = 1;
const REDEEM_THRESHOLD = 100;
const REDEEM_VALUE_REAIS = 10;
const REDEEM_VALIDITY_DAYS = 30;

function generateLoyaltyCouponCode(): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `FID_${rand}`;
}

/**
 * Aplica EARN pra uma venda concluída — somente se houver customerId,
 * a venda ainda não foi creditada e o líquido for > 0.
 *
 * Retorna { earned, balance, redeemedCoupon? } para o caller.
 */
export async function applyEarnForSale(
  tx: Prisma.TransactionClient,
  saleId: string,
): Promise<{
  earned: number;
  balance: number;
  redeemedCouponCode: string | null;
} | null> {
  const sale = await tx.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      customerId: true,
      totalRevenue: true,
      couponDiscount: true,
    },
  });
  if (!sale || !sale.customerId) return null;

  // Idempotência: se já tem EARN dessa venda, sai.
  const existing = await tx.loyaltyTransaction.findFirst({
    where: { saleId: sale.id, type: LoyaltyTransactionType.EARN },
    select: { id: true },
  });
  if (existing) return null;

  const liquido =
    Number(sale.totalRevenue) - Number(sale.couponDiscount);
  if (liquido <= 0) return null;

  const earned = Math.floor(liquido) * POINTS_PER_REAL;
  if (earned <= 0) return null;

  // Atualiza saldo do cliente + cria a transação EARN.
  const customer = await tx.customer.update({
    where: { id: sale.customerId },
    data: { loyaltyPoints: { increment: earned } },
    select: { id: true, loyaltyPoints: true },
  });
  await tx.loyaltyTransaction.create({
    data: {
      customerId: customer.id,
      type: LoyaltyTransactionType.EARN,
      points: earned,
      balanceAfter: customer.loyaltyPoints,
      saleId: sale.id,
    },
  });

  // Resgate automático: bateu o limiar? Cria cupom + REDEEM.
  // Loop pra cobrir caso de venda muito grande que cruze múltiplos limiares.
  let balance = customer.loyaltyPoints;
  let lastRedeemedCode: string | null = null;
  while (balance >= REDEEM_THRESHOLD) {
    const code = generateLoyaltyCouponCode();
    const validUntil = new Date(
      Date.now() + REDEEM_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
    );
    const coupon = await tx.coupon.create({
      data: {
        code,
        description: `Resgate fidelidade — cliente ${customer.id}`,
        type: "FIXED",
        value: REDEEM_VALUE_REAIS,
        maxUses: 1,
        validUntil,
        active: true,
      },
    });
    const updated = await tx.customer.update({
      where: { id: customer.id },
      data: { loyaltyPoints: { decrement: REDEEM_THRESHOLD } },
      select: { loyaltyPoints: true },
    });
    await tx.loyaltyTransaction.create({
      data: {
        customerId: customer.id,
        type: LoyaltyTransactionType.REDEEM,
        points: REDEEM_THRESHOLD,
        balanceAfter: updated.loyaltyPoints,
        couponId: coupon.id,
        notes: `Cupom ${code} gerado — válido até ${validUntil.toISOString().slice(0, 10)}`,
      },
    });
    balance = updated.loyaltyPoints;
    lastRedeemedCode = code;
  }

  return {
    earned,
    balance,
    redeemedCouponCode: lastRedeemedCode,
  };
}

// ---------- Histórico / consulta ----------

export async function listLoyaltyTransactions(
  customerId: string,
  limit = 50,
) {
  return prisma.loyaltyTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
}

export async function getLoyaltyStatus(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      loyaltyPoints: true,
    },
  });
  if (!customer) throw new BusinessError("Cliente não encontrado.");

  const lifetime = await prisma.loyaltyTransaction.aggregate({
    where: { customerId, type: LoyaltyTransactionType.EARN },
    _sum: { points: true },
  });
  const redeemed = await prisma.loyaltyTransaction.aggregate({
    where: { customerId, type: LoyaltyTransactionType.REDEEM },
    _sum: { points: true },
  });

  return {
    customerId: customer.id,
    customerName: customer.name,
    currentPoints: customer.loyaltyPoints,
    pointsToNextReward: Math.max(
      0,
      REDEEM_THRESHOLD - customer.loyaltyPoints,
    ),
    rewardThreshold: REDEEM_THRESHOLD,
    rewardValueReais: REDEEM_VALUE_REAIS,
    lifetimeEarned: Number(lifetime._sum.points ?? 0),
    lifetimeRedeemed: Number(redeemed._sum.points ?? 0),
  };
}

/** Ajuste manual (ADMIN) — soma ou subtrai pontos com nota. */
export async function adjustLoyaltyPoints(
  customerId: string,
  delta: number,
  notes: string,
  userId?: string,
): Promise<{ balance: number }> {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new BusinessError("Ajuste precisa ser um inteiro diferente de zero.");
  }
  return prisma.$transaction(async (tx) => {
    const c = await tx.customer.findUnique({
      where: { id: customerId },
      select: { id: true, loyaltyPoints: true },
    });
    if (!c) throw new BusinessError("Cliente não encontrado.");
    const newBalance = c.loyaltyPoints + delta;
    if (newBalance < 0) {
      throw new BusinessError(
        `Ajuste deixaria saldo negativo (saldo atual: ${c.loyaltyPoints}).`,
      );
    }
    const updated = await tx.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: newBalance },
      select: { loyaltyPoints: true },
    });
    await tx.loyaltyTransaction.create({
      data: {
        customerId,
        type: LoyaltyTransactionType.ADJUST,
        points: Math.abs(delta),
        balanceAfter: updated.loyaltyPoints,
        notes: `${delta > 0 ? "+" : "-"}${Math.abs(delta)} (ajuste manual)${userId ? ` — userId ${userId}` : ""} · ${notes}`,
      },
    });
    return { balance: updated.loyaltyPoints };
  });
}

// Constantes pra UI
export const LOYALTY_RULE = {
  pointsPerReal: POINTS_PER_REAL,
  redeemThreshold: REDEEM_THRESHOLD,
  redeemValueReais: REDEEM_VALUE_REAIS,
  validityDays: REDEEM_VALIDITY_DAYS,
};
