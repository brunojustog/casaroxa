"use server";

import { revalidatePath } from "next/cache";
import {
  couponCodeSchema,
  couponFormSchema,
} from "@/schemas/coupon.schema";
import {
  createCoupon,
  deleteCoupon,
  setCouponActive,
  updateCoupon,
  validateCouponForOrder,
  type CouponValidation,
} from "@/server/services/coupon.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateCoupons(id?: string) {
  revalidatePath("/cupons");
  if (id) revalidatePath(`/cupons/${id}`);
}

// ---------- ADMIN actions ----------

export async function createCouponAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = couponFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const c = await createCoupon(parsed.data);
    return { id: c.id };
  });
  if (result.ok) revalidateCoupons(result.data?.id);
  return result;
}

export async function updateCouponAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = couponFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const c = await updateCoupon(id, parsed.data);
    return { id: c.id };
  });
  if (result.ok) revalidateCoupons(id);
  return result;
}

export async function setCouponActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await setCouponActive(id, active);
  });
  if (result.ok) revalidateCoupons(id);
  return result;
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await deleteCoupon(id);
  });
  if (result.ok) revalidateCoupons();
  return result;
}

// ---------- Pública (checkout) ----------

/**
 * Valida cupom + subtotal e retorna preview do desconto. Não autentica:
 * é chamada do checkout público pra mostrar quanto o cliente vai economizar
 * antes de finalizar. A aplicação real (incremento de usedCount) acontece
 * no public-order.service em transação.
 */
export async function validateCouponAction(
  code: string,
  subtotal: number,
): Promise<ActionResult<CouponValidation>> {
  return runAction(async () => {
    const parsed = couponCodeSchema.safeParse(code);
    if (!parsed.success) {
      throw new BusinessError("Código de cupom inválido.");
    }
    const sub = Number(subtotal);
    if (!Number.isFinite(sub) || sub <= 0) {
      throw new BusinessError("Adicione itens ao carrinho antes de aplicar o cupom.");
    }
    return validateCouponForOrder(parsed.data, sub);
  });
}
