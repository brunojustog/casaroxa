"use server";

import { revalidatePath } from "next/cache";
import { CampaignAudienceKey } from "@prisma/client";
import { campaignFormSchema } from "@/schemas/campaign.schema";
import {
  createCampaign,
  deleteCampaign,
  dispatchCampaign,
  previewAudience,
} from "@/server/services/campaign.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidate(id?: string) {
  revalidatePath("/campanhas");
  if (id) revalidatePath(`/campanhas/${id}`);
}

export async function createCampaignAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    const parsed = campaignFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(
        parsed.error.errors[0]?.message ?? "Dados inválidos",
      );
    }
    return await createCampaign(
      {
        name: parsed.data.name,
        message: parsed.data.message,
        audienceKey: parsed.data.audienceKey,
        couponCode: parsed.data.couponCode,
        couponType: parsed.data.couponType,
        couponValue: parsed.data.couponValue,
        couponMaxUses: parsed.data.couponMaxUses ?? null,
        couponValidDays: parsed.data.couponValidDays,
      },
      user.id,
    );
  });
  if (result.ok) revalidate(result.data?.id);
  return result;
}

export async function deleteCampaignAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await deleteCampaign(id);
  });
  if (result.ok) revalidate();
  return result;
}

export async function dispatchCampaignAction(
  id: string,
): Promise<ActionResult<{ sent: number; failed: number; skipped: number }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    return await dispatchCampaign(id);
  });
  if (result.ok) revalidate(id);
  return result;
}

export async function previewAudienceAction(
  key: CampaignAudienceKey,
): Promise<ActionResult<{ count: number; sample: string[] }>> {
  return runAction(async () => {
    await requireRole("ADMIN");
    const customers = await previewAudience(key);
    return {
      count: customers.length,
      sample: customers.slice(0, 5).map((c) => c.name),
    };
  });
}
