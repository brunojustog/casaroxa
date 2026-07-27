"use server";

import { revalidatePath } from "next/cache";
import { FiscalEnvironment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cancelNfce,
  emitNfceForSale,
} from "@/server/services/fiscal.service";
import {
  BusinessError,
  requireAuth,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

/** Emite a NFC-e de uma venda concluída (CPF na nota opcional). */
export async function emitNfceAction(
  saleId: string,
  cpfCnpj?: string | null,
): Promise<ActionResult<{ docId: string; accessKey: string | null }>> {
  const result = await runAction(async () => {
    await requireAuth();
    const doc = await emitNfceForSale(saleId, cpfCnpj);
    return { docId: doc.id, accessKey: doc.accessKey };
  });
  if (result.ok) {
    revalidatePath("/fiscal");
    revalidatePath("/pdv");
  }
  return result;
}

/** Cancela uma NFC-e autorizada (justificativa mínima de 15 caracteres). */
export async function cancelNfceAction(
  docId: string,
  reason: string,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await cancelNfce(docId, reason);
  });
  if (result.ok) revalidatePath("/fiscal");
  return result;
}

/** Chave geral liga/desliga da emissão fiscal. */
export async function toggleFiscalAction(enabled: boolean): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await prisma.settings.update({ where: { id: 1 }, data: { fiscalEnabled: enabled } });
  });
  if (result.ok) {
    revalidatePath("/fiscal");
    revalidatePath("/pdv");
  }
  return result;
}

/** Atualiza configurações fiscais básicas. */
export async function updateFiscalConfigAction(raw: {
  environment?: string;
  series?: number;
  nextNumber?: number;
  defaultCfop?: string;
  defaultNcm?: string;
  cscId?: string | null;
}): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const env = raw.environment as FiscalEnvironment | undefined;
    if (env && !Object.values(FiscalEnvironment).includes(env)) {
      throw new BusinessError("Ambiente inválido.");
    }
    if (raw.defaultNcm && !/^\d{8}$/.test(raw.defaultNcm)) {
      throw new BusinessError("NCM padrão deve ter 8 dígitos.");
    }
    if (raw.defaultCfop && !/^\d{4}$/.test(raw.defaultCfop)) {
      throw new BusinessError("CFOP padrão deve ter 4 dígitos.");
    }
    await prisma.settings.update({
      where: { id: 1 },
      data: {
        fiscalEnvironment: env,
        fiscalSeries: raw.series,
        fiscalNextNumber: raw.nextNumber,
        fiscalDefaultCfop: raw.defaultCfop,
        fiscalDefaultNcm: raw.defaultNcm,
        fiscalCscId: raw.cscId === undefined ? undefined : raw.cscId || null,
      },
    });
  });
  if (result.ok) revalidatePath("/fiscal");
  return result;
}
