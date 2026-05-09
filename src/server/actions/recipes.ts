"use server";

import { revalidatePath } from "next/cache";
import { saveRecipeSchema, saveRecipeVersionSchema } from "@/schemas/recipe.schema";
import {
  saveRecipe,
  saveRecipeVersion,
  setRecipeReviewed,
} from "@/server/services/recipe.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateAfterRecipeChange(productId: string) {
  revalidatePath(`/fichas-tecnicas/${productId}`);
  revalidatePath("/fichas-tecnicas");
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${productId}`);
  revalidatePath("/combos");
  revalidatePath("/dashboard");
}

export async function saveRecipeAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = saveRecipeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const recipe = await saveRecipe(parsed.data);
    return { id: recipe.id };
  });
  if (result.ok) {
    const productId = (raw as { productId?: string })?.productId;
    if (productId) revalidateAfterRecipeChange(productId);
  }
  return result;
}

export async function setRecipeReviewedAction(
  productId: string,
  reviewed: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    await setRecipeReviewed(productId, reviewed, user.id);
  });
  if (result.ok) revalidateAfterRecipeChange(productId);
  return result;
}

export async function saveRecipeVersionAction(
  productId: string,
  raw: unknown,
): Promise<ActionResult<{ version: number }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = saveRecipeVersionSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const v = await saveRecipeVersion(productId, parsed.data.notes);
    return { version: v.version };
  });
  if (result.ok) revalidateAfterRecipeChange(productId);
  return result;
}
