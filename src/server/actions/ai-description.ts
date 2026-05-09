"use server";

import { generateDescription } from "@/server/ai/description.service";
import {
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

export async function generateDescriptionAction(input: {
  kind: "PRODUTO" | "COMBO";
  id: string;
}): Promise<ActionResult<{ description: string }>> {
  return runAction(async () => {
    await requireRole("ADMIN");
    const description = await generateDescription(input);
    return { description };
  });
}
