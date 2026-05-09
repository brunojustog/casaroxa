"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { scenarioFormSchema } from "@/schemas/scenario.schema";
import {
  createScenario,
  deleteScenario,
  duplicateScenario,
  updateScenario,
} from "@/server/services/scenario.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateScenarios(id?: string) {
  revalidatePath("/cenarios");
  if (id) revalidatePath(`/cenarios/${id}`);
  revalidatePath("/dashboard");
}

export async function createScenarioAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = scenarioFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const s = await createScenario(parsed.data);
    return { id: s.id };
  });
  if (result.ok) revalidateScenarios(result.data?.id);
  return result;
}

export async function updateScenarioAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = scenarioFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const s = await updateScenario(id, parsed.data);
    return { id: s.id };
  });
  if (result.ok) revalidateScenarios(id);
  return result;
}

export async function deleteScenarioAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await deleteScenario(id);
  });
  if (result.ok) revalidateScenarios();
  return result;
}

export async function duplicateScenarioAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const copy = await duplicateScenario(id);
    return { id: copy.id };
  });
  if (result.ok) {
    revalidateScenarios();
    if (result.data) redirect(`/cenarios/${result.data.id}`);
  }
  return result;
}
