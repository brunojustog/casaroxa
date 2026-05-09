"use server";

import { revalidatePath } from "next/cache";
import {
  inventoryAddItemSchema,
  inventoryCreateSchema,
  inventoryItemCountSchema,
} from "@/schemas/inventory.schema";
import {
  addInventoryItem,
  cancelInventory,
  closeInventory,
  countInventoryItem,
  createInventory,
  removeInventoryItem,
} from "@/server/services/inventory.service";
import {
  BusinessError,
  requireAuth,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateInventories(id?: string, didCascade = false) {
  revalidatePath("/inventarios");
  if (id) revalidatePath(`/inventarios/${id}`);
  if (didCascade) {
    revalidatePath("/estoque");
    revalidatePath("/dashboard");
  }
}

export async function createInventoryAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    const parsed = inventoryCreateSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const inv = await createInventory(parsed.data, user.id);
    return { id: inv.id };
  });
  if (result.ok) revalidateInventories(result.data?.id);
  return result;
}

export async function addInventoryItemAction(
  inventoryId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    const parsed = inventoryAddItemSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    await addInventoryItem(inventoryId, parsed.data.ingredientId);
  });
  if (result.ok) revalidateInventories(inventoryId);
  return result;
}

export async function removeInventoryItemAction(
  itemId: string,
  inventoryId: string,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    await removeInventoryItem(itemId);
  });
  if (result.ok) revalidateInventories(inventoryId);
  return result;
}

export async function countInventoryItemAction(
  itemId: string,
  inventoryId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    const parsed = inventoryItemCountSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    await countInventoryItem(itemId, parsed.data, user.id);
  });
  if (result.ok) revalidateInventories(inventoryId);
  return result;
}

export async function closeInventoryAction(
  id: string,
): Promise<ActionResult<{ movementsCreated: number }>> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    const r = await closeInventory(id, user.id);
    return { movementsCreated: r.movementsCreated };
  });
  if (result.ok) revalidateInventories(id, true);
  return result;
}

export async function cancelInventoryAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    await cancelInventory(id);
  });
  if (result.ok) revalidateInventories(id);
  return result;
}
