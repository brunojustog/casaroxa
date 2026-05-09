"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productFormSchema } from "@/schemas/product.schema";
import {
  createProduct,
  deleteProduct,
  duplicateProduct,
  setProductActive,
  setProductShowInMenu,
  updateProduct,
} from "@/server/services/product.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

export async function createProductAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = productFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const product = await createProduct(parsed.data);
    return { id: product.id };
  });
  if (result.ok) revalidatePath("/produtos");
  return result;
}

export async function updateProductAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = productFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const product = await updateProduct(id, parsed.data);
    return { id: product.id };
  });
  if (result.ok) {
    revalidatePath("/produtos");
    revalidatePath(`/produtos/${id}`);
    revalidatePath("/dashboard");
  }
  return result;
}

export async function setProductActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await setProductActive(id, active);
  });
  if (result.ok) {
    revalidatePath("/produtos");
    revalidatePath(`/produtos/${id}`);
  }
  return result;
}

export async function setProductShowInMenuAction(
  id: string,
  show: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await setProductShowInMenu(id, show);
  });
  if (result.ok) {
    revalidatePath("/produtos");
    revalidatePath(`/produtos/${id}`);
    revalidatePath("/cardapio");
    revalidatePath("/");
  }
  return result;
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await deleteProduct(id);
  });
  if (result.ok) revalidatePath("/produtos");
  return result;
}

export async function duplicateProductAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const copy = await duplicateProduct(id);
    return { id: copy.id };
  });
  if (result.ok) {
    revalidatePath("/produtos");
    if (result.data) redirect(`/produtos/${result.data.id}`);
  }
  return result;
}
