"use server";

import { revalidatePath } from "next/cache";
import { supplierFormSchema } from "@/schemas/supplier.schema";
import {
  createSupplier,
  deleteSupplier,
  setSupplierActive,
  updateSupplier,
} from "@/server/services/supplier.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateSuppliers(id?: string) {
  revalidatePath("/fornecedores");
  if (id) revalidatePath(`/fornecedores/${id}`);
  revalidatePath("/compras");
}

export async function createSupplierAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = supplierFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const s = await createSupplier(parsed.data);
    return { id: s.id };
  });
  if (result.ok) revalidateSuppliers(result.data?.id);
  return result;
}

export async function updateSupplierAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = supplierFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const s = await updateSupplier(id, parsed.data);
    return { id: s.id };
  });
  if (result.ok) revalidateSuppliers(id);
  return result;
}

export async function setSupplierActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await setSupplierActive(id, active);
  });
  if (result.ok) revalidateSuppliers(id);
  return result;
}

export async function deleteSupplierAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await deleteSupplier(id);
  });
  if (result.ok) revalidateSuppliers();
  return result;
}
