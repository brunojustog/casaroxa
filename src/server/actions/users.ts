"use server";

import { revalidatePath } from "next/cache";
import {
  userCreateSchema,
  userUpdateSchema,
} from "@/schemas/user.schema";
import {
  createUser,
  deleteUser,
  setUserActive,
  updateUser,
} from "@/server/services/user.service";
import {
  BusinessError,
  ForbiddenError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateUsers(id?: string) {
  revalidatePath("/usuarios");
  if (id) revalidatePath(`/usuarios/${id}`);
}

export async function createUserAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = userCreateSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const u = await createUser(parsed.data);
    return { id: u.id };
  });
  if (result.ok) revalidateUsers(result.data?.id);
  return result;
}

export async function updateUserAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = userUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    // Trava extra: ADMIN não pode rebaixar a si mesmo. (Se ele é o último,
    // o service já barra; mas mesmo não sendo, isso evita auto-trancar fora
    // da área administrativa por engano.)
    const user = await requireRole("ADMIN");
    if (user.id === id && parsed.data.role !== "ADMIN") {
      throw new ForbiddenError("Você não pode rebaixar seu próprio usuário.");
    }
    if (user.id === id && !parsed.data.active) {
      throw new ForbiddenError("Você não pode desativar seu próprio usuário.");
    }
    const u = await updateUser(id, parsed.data);
    return { id: u.id };
  });
  if (result.ok) revalidateUsers(id);
  return result;
}

export async function setUserActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    if (user.id === id && !active) {
      throw new ForbiddenError("Você não pode desativar seu próprio usuário.");
    }
    await setUserActive(id, active);
  });
  if (result.ok) revalidateUsers(id);
  return result;
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    if (user.id === id) {
      throw new ForbiddenError("Você não pode excluir seu próprio usuário.");
    }
    await deleteUser(id);
  });
  if (result.ok) revalidateUsers();
  return result;
}
