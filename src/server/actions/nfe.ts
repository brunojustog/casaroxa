"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importNfePayloadSchema } from "@/schemas/nfe.schema";
import { analyzeNfe, importNfe } from "@/server/services/nfe-import.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";
import type { NfePreview } from "@/server/services/nfe-import.service";

/**
 * Recebe o XML da NFe via FormData, parseia e retorna o preview enriquecido.
 * Não faz nenhuma alteração no banco.
 */
export async function analyzeNfeAction(
  formData: FormData,
): Promise<ActionResult<NfePreview>> {
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
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xml")) {
      throw new BusinessError("Apenas arquivos .xml são aceitos.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    return analyzeNfe(buffer);
  });
}

/**
 * Aplica a importação com a decisão final do usuário sobre cada item e fornecedor.
 * Pode salvar como RASCUNHO ou CONFIRMADA (com cascata de custo).
 */
export async function importNfeAction(
  raw: unknown,
): Promise<ActionResult<{ purchaseId: string }>> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    const parsed = importNfePayloadSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const r = await importNfe(parsed.data, user.id);
    return { purchaseId: r.purchaseId };
  });

  if (result.ok) {
    revalidatePath("/compras");
    revalidatePath("/fornecedores");
    revalidatePath("/estoque");
    revalidatePath("/ingredientes");
    revalidatePath("/produtos");
    revalidatePath("/combos");
    revalidatePath("/dashboard");
    if (result.data) {
      redirect(`/compras/${result.data.purchaseId}`);
    }
  }
  return result;
}
