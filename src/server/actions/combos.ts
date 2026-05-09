"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveComboSchema } from "@/schemas/combo.schema";
import {
  deleteCombo,
  duplicateCombo,
  saveCombo,
  setComboActive,
  setComboShowInMenu,
} from "@/server/services/combo.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateCombos(id?: string) {
  revalidatePath("/combos");
  if (id) revalidatePath(`/combos/${id}`);
  revalidatePath("/dashboard");
}

function revalidateCombosAndMenu(id?: string) {
  revalidateCombos(id);
  revalidatePath("/cardapio");
  revalidatePath("/");
}

export async function saveComboAction(
  raw: unknown,
  options: { id?: string } = {},
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = saveComboSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const combo = await saveCombo(parsed.data, { id: options.id });
    return { id: combo.id };
  });
  if (result.ok) revalidateCombos(result.data?.id);
  return result;
}

export async function setComboActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await setComboActive(id, active);
  });
  if (result.ok) revalidateCombos(id);
  return result;
}

export async function setComboShowInMenuAction(
  id: string,
  show: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await setComboShowInMenu(id, show);
  });
  if (result.ok) revalidateCombosAndMenu(id);
  return result;
}

export async function deleteComboAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await deleteCombo(id);
  });
  if (result.ok) revalidateCombos();
  return result;
}

export async function duplicateComboAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const copy = await duplicateCombo(id);
    return { id: copy.id };
  });
  if (result.ok) {
    revalidateCombos();
    if (result.data) redirect(`/combos/${result.data.id}`);
  }
  return result;
}
