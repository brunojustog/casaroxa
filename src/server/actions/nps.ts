"use server";

import { revalidatePath } from "next/cache";
import {
  sendNpsRequest,
  updateReviewAdmin,
} from "@/server/services/nps.service";
import {
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

export async function sendNpsRequestAction(
  saleId: string,
): Promise<ActionResult<{ token: string; whatsappStatus: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    return await sendNpsRequest(saleId);
  });
  if (result.ok) {
    revalidatePath(`/vendas/${saleId}`);
    revalidatePath("/avaliacoes");
  }
  return result;
}

export async function updateReviewAction(
  id: string,
  input: { adminNotes: string | null; followupCouponId: string | null },
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await updateReviewAdmin(id, input);
  });
  if (result.ok) {
    revalidatePath(`/avaliacoes/${id}`);
    revalidatePath("/avaliacoes");
  }
  return result;
}
