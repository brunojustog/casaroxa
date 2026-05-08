"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ingredientFormSchema } from "@/schemas/ingredient.schema";
import {
  createIngredient,
  deleteIngredient,
  setIngredientActive,
  updateIngredient,
} from "@/server/services/ingredient.service";
import { BusinessError, requireAuth, runAction, type ActionResult } from "@/server/auth-helpers";

export async function createIngredientAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    const parsed = ingredientFormSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      throw new BusinessError(first?.message ?? "Dados inválidos");
    }
    const ingredient = await createIngredient(parsed.data, user.id);
    return { id: ingredient.id };
  });
  if (result.ok) revalidatePath("/ingredientes");
  return result;
}

export async function updateIngredientAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    const parsed = ingredientFormSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      throw new BusinessError(first?.message ?? "Dados inválidos");
    }
    const ingredient = await updateIngredient(id, parsed.data, user.id);
    return { id: ingredient.id };
  });
  if (result.ok) {
    revalidatePath("/ingredientes");
    revalidatePath(`/ingredientes/${id}`);
    revalidatePath("/produtos");
    revalidatePath("/combos");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function setIngredientActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    await setIngredientActive(id, active);
  });
  if (result.ok) {
    revalidatePath("/ingredientes");
    revalidatePath(`/ingredientes/${id}`);
  }
  return result;
}

export async function deleteIngredientAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    await deleteIngredient(id);
  });
  if (result.ok) {
    revalidatePath("/ingredientes");
  }
  return result;
}

/** Após criar/editar com sucesso, redireciona para a lista. */
export async function redirectToIngredientsList() {
  "use server";
  redirect("/ingredientes");
}
