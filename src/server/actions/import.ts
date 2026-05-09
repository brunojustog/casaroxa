"use server";

import { revalidatePath } from "next/cache";
import {
  importSpreadsheet,
} from "@/server/importers/xlsx-importer";
import { importOptionsSchema } from "@/schemas/import.schema";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";
import type { ImportResult } from "@/schemas/import.schema";

export async function importXlsxAction(
  formData: FormData,
): Promise<ActionResult<ImportResult>> {
  return runAction(async () => {
    await requireRole("ADMIN");

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new BusinessError("Arquivo não enviado.");
    }
    if (file.size === 0) {
      throw new BusinessError("Arquivo vazio.");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BusinessError("Arquivo maior que 10 MB.");
    }

    const parsed = importOptionsSchema.safeParse({
      mode: formData.get("mode") ?? "upsert",
      dryRun: formData.get("dryRun") === "true",
    });
    if (!parsed.success) throw new BusinessError("Opções inválidas.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importSpreadsheet(buffer, file.name, parsed.data);

    if (result.executed) {
      revalidatePath("/ingredientes");
      revalidatePath("/produtos");
      revalidatePath("/fichas-tecnicas");
      revalidatePath("/combos");
      revalidatePath("/dashboard");
      revalidatePath("/importar");
    }

    return result;
  });
}
