"use server";

import { revalidatePath } from "next/cache";
import {
  saleHeaderFormSchema,
  saleItemFormSchema,
  saleItemUpdateSchema,
  salePaymentFormSchema,
  saleProgressUpdateSchema,
} from "@/schemas/sale.schema";
import {
  addSaleItem,
  addSalePayment,
  cancelSale,
  concludeSale,
  createSale,
  removeSaleItem,
  removeSalePayment,
  setSaleProgress,
  updateSaleHeader,
  updateSaleItem,
} from "@/server/services/sales.service";
import {
  BusinessError,
  requireAuth,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateSales(id?: string) {
  revalidatePath("/vendas");
  if (id) revalidatePath(`/vendas/${id}`);
  revalidatePath("/dashboard");
}

function revalidateAfterStockChange(id?: string) {
  revalidateSales(id);
  revalidatePath("/estoque");
}

// ---------- Cabeçalho ----------

export async function createSaleAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    const parsed = saleHeaderFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const sale = await createSale(parsed.data, user.id);
    return { id: sale.id };
  });
  if (result.ok) revalidateSales(result.data?.id);
  return result;
}

export async function updateSaleHeaderAction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    const parsed = saleHeaderFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    await updateSaleHeader(id, parsed.data);
  });
  if (result.ok) revalidateSales(id);
  return result;
}

// ---------- Items ----------

export async function addSaleItemAction(
  saleId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    const parsed = saleItemFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    await addSaleItem(saleId, parsed.data);
  });
  if (result.ok) revalidateSales(saleId);
  return result;
}

export async function removeSaleItemAction(
  itemId: string,
  saleId: string,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    await removeSaleItem(itemId);
  });
  if (result.ok) revalidateSales(saleId);
  return result;
}

export async function updateSaleItemAction(
  itemId: string,
  saleId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    const parsed = saleItemUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    await updateSaleItem(itemId, parsed.data);
  });
  if (result.ok) revalidateSales(saleId);
  return result;
}

// ---------- Pagamentos ----------

export async function addSalePaymentAction(
  saleId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    const parsed = salePaymentFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    await addSalePayment(saleId, parsed.data);
  });
  if (result.ok) revalidateSales(saleId);
  return result;
}

export async function removeSalePaymentAction(
  paymentId: string,
  saleId: string,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    await removeSalePayment(paymentId);
  });
  if (result.ok) revalidateSales(saleId);
  return result;
}

// ---------- Concluir / Cancelar ----------

export async function concludeSaleAction(saleId: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    await concludeSale(saleId, user.id);
  });
  if (result.ok) revalidateAfterStockChange(saleId);
  return result;
}

export async function cancelSaleAction(
  saleId: string,
  reason: string | null,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireAuth();
    await cancelSale(saleId, user.id, reason && reason.trim().length > 0 ? reason.trim() : null);
  });
  if (result.ok) revalidateAfterStockChange(saleId);
  return result;
}

// ---------- Tracking / progress ----------

export async function setSaleProgressAction(
  saleId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireAuth();
    const parsed = saleProgressUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    await setSaleProgress(saleId, parsed.data);
  });
  if (result.ok) revalidateSales(saleId);
  return result;
}
