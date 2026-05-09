"use server";

import { revalidatePath } from "next/cache";
import { customerFormSchema } from "@/schemas/customer.schema";
import {
  createCustomer,
  deleteCustomer,
  generateBirthdayCoupon,
  setCustomerActive,
  updateCustomer,
} from "@/server/services/customer.service";
import { sendText } from "@/server/services/whatsapp.service";
import { prisma } from "@/lib/prisma";
import {
  BusinessError,
  requireAuth,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateCustomers(id?: string) {
  revalidatePath("/clientes");
  if (id) revalidatePath(`/clientes/${id}`);
}

export async function createCustomerAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireAuth();
    const parsed = customerFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const c = await createCustomer(parsed.data);
    return { id: c.id };
  });
  if (result.ok) revalidateCustomers(result.data?.id);
  return result;
}

export async function updateCustomerAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireAuth();
    const parsed = customerFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const c = await updateCustomer(id, parsed.data);
    return { id: c.id };
  });
  if (result.ok) revalidateCustomers(id);
  return result;
}

export async function setCustomerActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    await setCustomerActive(id, active);
  });
  if (result.ok) revalidateCustomers(id);
  return result;
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    await deleteCustomer(id);
  });
  if (result.ok) revalidateCustomers();
  return result;
}

export async function generateBirthdayCouponAction(
  customerId: string,
  percentOff?: number,
): Promise<ActionResult<{ code: string }>> {
  const result = await runAction(async () => {
    await requireAuth();
    const c = await generateBirthdayCoupon(customerId, { percentOff });
    return { code: c.code };
  });
  if (result.ok) {
    revalidateCustomers(customerId);
    revalidatePath("/cupons");
    revalidatePath("/dashboard");
  }
  return result;
}

/**
 * Gera o cupom (idempotente) E envia direto via wuzapi se a config
 * estiver ligada. Se WhatsApp não estiver configurado/ligado,
 * retorna o código e a UI cai no fallback de abrir wa.me.
 */
export async function sendBirthdayCouponWhatsAppAction(
  customerId: string,
): Promise<
  ActionResult<{
    code: string;
    sent: boolean;
    skippedReason?: string;
    error?: string;
  }>
> {
  return runAction(async () => {
    await requireAuth();
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, phone: true },
    });
    if (!customer) throw new BusinessError("Cliente não encontrado.");

    const coupon = await generateBirthdayCoupon(customerId);
    revalidatePath(`/clientes/${customerId}`);
    revalidatePath("/cupons");
    revalidatePath("/dashboard");

    const validUntil = coupon.validUntil
      ? new Date(coupon.validUntil).toLocaleDateString("pt-BR")
      : "fim do mês";
    const message = `Olá ${customer.name}! 🎂 A Casa Roxa preparou um cupom especial de aniversário pra você: *${coupon.code}* (${Number(coupon.value)}% off, válido até ${validUntil}). É só usar no nosso cardápio: https://casaroxa.com.br/cardapio`;

    const result = await sendText({
      phone: customer.phone,
      message,
      event: "BIRTHDAY_COUPON",
      toggleField: "whatsappNotifyBirthday",
      customerId: customer.id,
    });

    if (result.status === "SENT") {
      return { code: coupon.code, sent: true };
    }
    if (result.status === "SKIPPED") {
      return {
        code: coupon.code,
        sent: false,
        skippedReason: result.reason,
      };
    }
    return { code: coupon.code, sent: false, error: result.error };
  });
}
