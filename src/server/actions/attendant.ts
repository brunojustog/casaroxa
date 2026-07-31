"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { setConversationHandoff } from "@/server/ai/attendant.service";
import {
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

/** Liga/desliga o atendente IA do WhatsApp. */
export async function toggleAttendantAction(enabled: boolean): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await prisma.settings.update({
      where: { id: 1 },
      data: { aiAttendantEnabled: enabled },
    });
  });
  if (result.ok) revalidatePath("/atendente");
  return result;
}

/** Atualiza a lista de telefones do modo teste (vazio = responde a todos). */
export async function setAttendantTestPhonesAction(
  phones: string,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const clean = phones
      .split(/[,;\s]+/)
      .map((p) => p.replace(/\D/g, ""))
      .filter((p) => p.length >= 10)
      .join(",");
    await prisma.settings.update({
      where: { id: 1 },
      data: { aiAttendantTestPhones: clean.length > 0 ? clean : null },
    });
  });
  if (result.ok) revalidatePath("/atendente");
  return result;
}

/** Devolve a conversa pra IA (ou tira dela e assume manualmente). */
export async function setConversationHandoffAction(
  conversationId: string,
  handedOff: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await setConversationHandoff(conversationId, handedOff);
  });
  if (result.ok) revalidatePath("/atendente");
  return result;
}
