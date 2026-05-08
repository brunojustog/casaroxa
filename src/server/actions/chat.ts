"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  deleteConversation,
  sendMessage,
  type SendMessageResult,
} from "@/server/ai/chat.service";
import {
  BusinessError,
  requireAuth,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

const sendMessageSchema = z.object({
  conversationId: z.string().optional().nullable(),
  message: z.string().trim().min(1, "Mensagem vazia.").max(4000, "Mensagem muito longa (máx 4000)."),
});

export async function sendChatMessageAction(
  raw: unknown,
): Promise<ActionResult<SendMessageResult>> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    const parsed = sendMessageSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    return sendMessage({
      conversationId: parsed.data.conversationId ?? undefined,
      userMessage: parsed.data.message,
      userId: user.id,
    });
  });
  if (result.ok) {
    revalidatePath("/assistente");
    if (result.data) revalidatePath(`/assistente/${result.data.conversationId}`);
  }
  return result;
}

export async function deleteConversationAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    await deleteConversation(id);
  });
  if (result.ok) revalidatePath("/assistente");
  return result;
}
