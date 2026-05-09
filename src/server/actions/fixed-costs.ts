"use server";

import { revalidatePath } from "next/cache";
import { fixedCostItemFormSchema } from "@/schemas/fixed-cost.schema";
import {
  createFixedCostItem,
  deleteFixedCostItem,
  setFixedCostItemActive,
  updateFixedCostItem,
} from "@/server/services/fixed-costs.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateFixedCosts(id?: string) {
  revalidatePath("/custos-fixos");
  if (id) revalidatePath(`/custos-fixos/${id}`);
  // O cache em Settings mudou — invalidar quem lê o custo fixo:
  revalidatePath("/configuracoes");
  revalidatePath("/dashboard");
  revalidatePath("/cenarios");
  revalidatePath("/simulador");
}

export async function createFixedCostItemAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    const parsed = fixedCostItemFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const item = await createFixedCostItem(parsed.data, user.id);
    return { id: item.id };
  });
  if (result.ok) revalidateFixedCosts(result.data?.id);
  return result;
}

export async function updateFixedCostItemAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    const parsed = fixedCostItemFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const item = await updateFixedCostItem(id, parsed.data, user.id);
    return { id: item.id };
  });
  if (result.ok) revalidateFixedCosts(id);
  return result;
}

export async function setFixedCostItemActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    await setFixedCostItemActive(id, active, user.id);
  });
  if (result.ok) revalidateFixedCosts(id);
  return result;
}

export async function deleteFixedCostItemAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await deleteFixedCostItem(id);
  });
  if (result.ok) revalidateFixedCosts();
  return result;
}
