"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";
import { sendPushToAllCustomers } from "@/server/services/push.service";

const broadcastSchema = z.object({
  title: z.string().trim().min(3, "Título muito curto").max(80, "Título muito longo"),
  body: z.string().trim().min(3, "Mensagem muito curta").max(300, "Mensagem muito longa"),
  url: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine(
      (v) => !v || v.startsWith("/") || v.startsWith("https://"),
      "Link deve começar com / (página do site) ou https://",
    ),
});

export async function sendPushBroadcastAction(
  raw: unknown,
): Promise<ActionResult<{ sent: number; failed: number }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = broadcastSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const { sent, failed } = await sendPushToAllCustomers({
      title: parsed.data.title,
      body: parsed.data.body,
      url: parsed.data.url ?? "/",
      tag: "casa-roxa-novidade",
    });
    if (sent === 0 && failed === 0) {
      throw new BusinessError(
        "Nenhum cliente com notificações ativas ainda. Divulgue o app primeiro!",
      );
    }
    return { sent, failed };
  });
  if (result.ok) revalidatePath("/notificacoes");
  return result;
}
