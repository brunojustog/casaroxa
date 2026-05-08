"use server";

import { revalidatePath } from "next/cache";
import { savePurchaseSchema } from "@/schemas/purchase.schema";
import {
  cancelPurchase,
  confirmPurchase,
  deletePurchase,
  savePurchase,
} from "@/server/services/purchase.service";
import {
  BusinessError,
  requireAuth,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidatePurchases(id?: string, didCascade = false) {
  revalidatePath("/compras");
  if (id) revalidatePath(`/compras/${id}`);
  if (didCascade) {
    revalidatePath("/estoque");
    revalidatePath("/ingredientes");
    revalidatePath("/produtos");
    revalidatePath("/combos");
    revalidatePath("/dashboard");
  }
}

export async function savePurchaseAction(
  raw: unknown,
  options: { id?: string } = {},
): Promise<ActionResult<{ id: string; totalAmount: number }>> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    const parsed = savePurchaseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    return savePurchase(parsed.data, options, user.id);
  });
  if (result.ok) revalidatePurchases(result.data?.id);
  return result;
}

export async function confirmPurchaseAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    await confirmPurchase(id, user.id);
  });
  if (result.ok) revalidatePurchases(id, true);
  return result;
}

export async function cancelPurchaseAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    await cancelPurchase(id, user.id);
  });
  if (result.ok) revalidatePurchases(id, true);
  return result;
}

export async function deletePurchaseAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    await deletePurchase(id);
  });
  if (result.ok) revalidatePurchases();
  return result;
}
