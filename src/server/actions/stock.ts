"use server";

import { revalidatePath } from "next/cache";
import { stockMovementFormSchema } from "@/schemas/stock.schema";
import { registerStockMovement } from "@/server/services/stock.service";
import {
  BusinessError,
  requireAuth,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

export async function registerStockMovementAction(
  raw: unknown,
): Promise<ActionResult<{ id: string; balance: number }>> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    const parsed = stockMovementFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    return registerStockMovement(parsed.data, user.id);
  });
  if (result.ok) {
    revalidatePath("/estoque");
    revalidatePath("/dashboard");
    if ((raw as { ingredientId?: string })?.ingredientId) {
      revalidatePath(`/estoque/${(raw as { ingredientId: string }).ingredientId}`);
    }
  }
  return result;
}
