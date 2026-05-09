import { CouponType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { roundMoney, toDecimal } from "@/lib/decimal";
import { BusinessError } from "@/server/auth-helpers";
import type {
  CouponFormData,
  CouponListFilters,
} from "@/schemas/coupon.schema";

// ---------- CRUD ----------

export async function listCoupons(filters: CouponListFilters) {
  const where: Prisma.CouponWhereInput = {};
  if (filters.active === "active") where.active = true;
  else if (filters.active === "inactive") where.active = false;

  if (filters.search && filters.search.trim().length > 0) {
    where.OR = [
      { code: { contains: filters.search.toUpperCase() } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.coupon.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sales: true } } },
  });
}

export function getCouponById(id: string) {
  return prisma.coupon.findUnique({ where: { id } });
}

export function getCouponByCode(code: string) {
  return prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
}

export async function createCoupon(input: CouponFormData) {
  const dup = await prisma.coupon.findUnique({
    where: { code: input.code },
    select: { id: true },
  });
  if (dup) throw new BusinessError(`Já existe um cupom com o código ${input.code}.`);

  return prisma.coupon.create({
    data: {
      code: input.code,
      description: input.description,
      type: input.type,
      value: input.value,
      maxUses: input.maxUses,
      minOrderAmount: input.minOrderAmount,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      active: input.active,
    },
  });
}

export async function updateCoupon(id: string, input: CouponFormData) {
  const current = await prisma.coupon.findUnique({ where: { id } });
  if (!current) throw new BusinessError("Cupom não encontrado.");

  if (current.code !== input.code) {
    const dup = await prisma.coupon.findUnique({
      where: { code: input.code },
      select: { id: true },
    });
    if (dup && dup.id !== id) {
      throw new BusinessError(`Já existe um cupom com o código ${input.code}.`);
    }
  }
  if (input.maxUses !== null && input.maxUses < current.usedCount) {
    throw new BusinessError(
      `Limite menor que o número de usos atuais (${current.usedCount}).`,
    );
  }

  return prisma.coupon.update({
    where: { id },
    data: {
      code: input.code,
      description: input.description,
      type: input.type,
      value: input.value,
      maxUses: input.maxUses,
      minOrderAmount: input.minOrderAmount,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      active: input.active,
    },
  });
}

export async function setCouponActive(id: string, active: boolean) {
  const c = await prisma.coupon.findUnique({ where: { id }, select: { id: true } });
  if (!c) throw new BusinessError("Cupom não encontrado.");
  return prisma.coupon.update({ where: { id }, data: { active } });
}

export async function deleteCoupon(id: string) {
  const used = await prisma.sale.count({ where: { couponId: id } });
  if (used > 0) {
    throw new BusinessError(
      `Este cupom já foi usado em ${used} venda(s). Inative em vez de excluir.`,
    );
  }
  await prisma.coupon.delete({ where: { id } });
}

// ---------- Validação + cálculo ----------

export type CouponValidation =
  | {
      valid: true;
      coupon: { id: string; code: string; type: CouponType; value: number };
      discount: number;
      total: number;
    }
  | { valid: false; error: string };

/**
 * Valida o cupom contra um subtotal e retorna o desconto calculado.
 * Não persiste nada — usado pra preview no checkout E pra validação final
 * antes de aplicar (na transação de criar pedido).
 *
 * Regras:
 *   - Cupom existe e active=true
 *   - Dentro de validFrom..validUntil (se definidos)
 *   - usedCount < maxUses (se definido)
 *   - subtotal >= minOrderAmount (se definido)
 *   - PERCENT: discount = subtotal * (value/100), arredondado em R$
 *   - FIXED:   discount = min(value, subtotal)  — não passa do subtotal
 */
export async function validateCouponForOrder(
  code: string,
  subtotal: number,
): Promise<CouponValidation> {
  const coupon = await getCouponByCode(code);
  if (!coupon) return { valid: false, error: "Cupom não encontrado." };
  if (!coupon.active) return { valid: false, error: "Cupom inativo." };

  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) {
    return { valid: false, error: "Cupom ainda não está válido." };
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    return { valid: false, error: "Cupom expirado." };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, error: "Cupom atingiu o limite de usos." };
  }
  const minOrder = coupon.minOrderAmount ? Number(coupon.minOrderAmount) : 0;
  if (minOrder > 0 && subtotal < minOrder) {
    return {
      valid: false,
      error: `Pedido mínimo pra esse cupom: R$ ${minOrder.toFixed(2).replace(".", ",")}.`,
    };
  }

  const value = Number(coupon.value);
  let discount = 0;
  if (coupon.type === "PERCENT") {
    discount = Number(roundMoney(toDecimal(subtotal).mul(value).div(100)));
  } else {
    discount = Math.min(value, subtotal);
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value,
    },
    discount,
    total: Math.max(0, subtotal - discount),
  };
}

/**
 * Aplica o cupom dentro de uma transação. Re-valida (proteção contra TOCTOU)
 * e incrementa usedCount atomicamente. Retorna o desconto a registrar no Sale.
 */
export async function applyCouponInTransaction(
  tx: Prisma.TransactionClient,
  code: string,
  subtotal: number,
): Promise<{
  couponId: string;
  couponCode: string;
  discount: number;
}> {
  const coupon = await tx.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!coupon) throw new BusinessError("Cupom não encontrado.");
  if (!coupon.active) throw new BusinessError("Cupom inativo.");

  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) {
    throw new BusinessError("Cupom ainda não está válido.");
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    throw new BusinessError("Cupom expirado.");
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new BusinessError("Cupom atingiu o limite de usos.");
  }
  const minOrder = coupon.minOrderAmount ? Number(coupon.minOrderAmount) : 0;
  if (minOrder > 0 && subtotal < minOrder) {
    throw new BusinessError(
      `Pedido mínimo pra esse cupom: R$ ${minOrder.toFixed(2).replace(".", ",")}.`,
    );
  }

  const value = Number(coupon.value);
  let discount = 0;
  if (coupon.type === "PERCENT") {
    discount = Number(roundMoney(toDecimal(subtotal).mul(value).div(100)));
  } else {
    discount = Math.min(value, subtotal);
  }

  await tx.coupon.update({
    where: { id: coupon.id },
    data: { usedCount: { increment: 1 } },
  });

  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discount,
  };
}
