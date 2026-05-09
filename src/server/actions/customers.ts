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
