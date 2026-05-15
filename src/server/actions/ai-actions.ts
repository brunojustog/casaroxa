"use server";

import { revalidatePath } from "next/cache";
import {
  approveAction,
  rejectAction,
} from "@/server/services/ai-action.service";
import {
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

export async function approveAiActionAction(
  id: string,
): Promise<ActionResult<{ id: string; result?: unknown }>> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    const out = await approveAction(id, user.id);
    return { id: out.id, result: out.result };
  });
  if (result.ok) {
    revalidatePath("/aprovacoes-ia");
    revalidatePath(`/aprovacoes-ia/${id}`);
  }
  return result;
}

export async function rejectAiActionAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    await rejectAction(id, user.id);
  });
  if (result.ok) {
    revalidatePath("/aprovacoes-ia");
    revalidatePath(`/aprovacoes-ia/${id}`);
  }
  return result;
}
