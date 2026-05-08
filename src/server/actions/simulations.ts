"use server";

import { revalidatePath } from "next/cache";
import {
  applyPriceSchema,
  saveSimulationSchema,
} from "@/schemas/simulation.schema";
import {
  applyPriceToTarget,
  saveSimulation,
} from "@/server/services/simulation.service";
import {
  BusinessError,
  requireAuth,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

export async function saveSimulationAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireAuth();
    const parsed = saveSimulationSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const sim = await saveSimulation(parsed.data);
    return { id: sim.id };
  });
  if (result.ok) revalidatePath("/simulador");
  return result;
}

export async function applyPriceAction(raw: unknown): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    const parsed = applyPriceSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    await applyPriceToTarget(parsed.data);
  });
  if (result.ok) {
    revalidatePath("/simulador");
    revalidatePath("/produtos");
    revalidatePath("/combos");
    revalidatePath("/dashboard");
  }
  return result;
}
