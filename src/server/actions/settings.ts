"use server";

import { revalidatePath } from "next/cache";
import { settingsFormSchema } from "@/schemas/settings.schema";
import { updateSettings } from "@/server/services/settings.service";
import {
  BusinessError,
  requireAuth,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

export async function updateSettingsAction(
  raw: unknown,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    const parsed = settingsFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    await updateSettings(parsed.data, user.id);
  });
  if (result.ok) {
    revalidatePath("/configuracoes");
    revalidatePath("/dashboard");
    revalidatePath("/cenarios");
    revalidatePath("/simulador");
  }
  return result;
}
