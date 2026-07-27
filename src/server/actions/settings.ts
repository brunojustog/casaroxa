"use server";

import { revalidatePath } from "next/cache";
import { settingsFormSchema } from "@/schemas/settings.schema";
import { updateSettings } from "@/server/services/settings.service";
import { prisma } from "@/lib/prisma";
import {
  BusinessError,
  requireAuth,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

/**
 * Chave rápida do dashboard: abre/fecha a cozinha online (cardápio).
 * Encomendas e empório não são afetados.
 */
export async function toggleCardapioAction(
  closed: boolean,
  message?: string | null,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    await prisma.settings.update({
      where: { id: 1 },
      data: {
        cardapioClosed: closed,
        cardapioClosedMessage:
          message && message.trim().length > 0 ? message.trim().slice(0, 300) : null,
      },
    });
  });
  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/cardapio");
    revalidatePath("/");
  }
  return result;
}

export async function updateSettingsAction(
  raw: unknown,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
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
