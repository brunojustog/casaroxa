import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import type {
  UserCreateData,
  UserListFilters,
  UserUpdateData,
} from "@/schemas/user.schema";

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listUsers(filters: UserListFilters) {
  const where: Prisma.UserWhereInput = {};
  if (filters.active === "active") where.active = true;
  else if (filters.active === "inactive") where.active = false;

  if (filters.search && filters.search.trim().length > 0) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    select: SAFE_SELECT,
  });
}

export function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
}

export async function createUser(input: UserCreateData) {
  const dup = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (dup) throw new BusinessError(`Já existe um usuário com o e-mail ${input.email}.`);

  const passwordHash = await bcrypt.hash(input.password, 10);

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      active: input.active,
      passwordHash,
    },
    select: SAFE_SELECT,
  });
}

export async function updateUser(id: string, input: UserUpdateData) {
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw new BusinessError("Usuário não encontrado.");

  if (current.email !== input.email) {
    const dup = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (dup && dup.id !== id) {
      throw new BusinessError(`Já existe um usuário com o e-mail ${input.email}.`);
    }
  }

  const data: Prisma.UserUpdateInput = {
    name: input.name,
    email: input.email,
    role: input.role,
    active: input.active,
  };
  if (input.password) {
    data.passwordHash = await bcrypt.hash(input.password, 10);
  }

  return prisma.user.update({ where: { id }, data, select: SAFE_SELECT });
}

/**
 * Trava: o último ADMIN ativo não pode ser desativado nem virar OPERADOR
 * — sempre tem que sobrar pelo menos um ADMIN ativo no sistema.
 */
async function ensureNotLastActiveAdmin(
  id: string,
  current: { role: string; active: boolean },
) {
  if (current.role !== "ADMIN" || !current.active) return;
  const others = await prisma.user.count({
    where: { role: "ADMIN", active: true, NOT: { id } },
  });
  if (others === 0) {
    throw new BusinessError(
      "Este é o último administrador ativo. Promova outro usuário a ADMIN antes de alterar.",
    );
  }
}

export async function setUserActive(id: string, active: boolean) {
  const current = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, active: true },
  });
  if (!current) throw new BusinessError("Usuário não encontrado.");
  if (!active) await ensureNotLastActiveAdmin(id, current);
  return prisma.user.update({ where: { id }, data: { active }, select: SAFE_SELECT });
}

export async function deleteUser(id: string) {
  const current = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, active: true },
  });
  if (!current) throw new BusinessError("Usuário não encontrado.");
  await ensureNotLastActiveAdmin(id, current);
  // Hard delete: só seguro se não houver FKs apontando. Caso contrário,
  // a ação no UI deve oferecer "desativar" em vez de "excluir".
  try {
    await prisma.user.delete({ where: { id } });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2003"
    ) {
      throw new BusinessError(
        "Este usuário tem registros vinculados (vendas/movimentos). Inative-o em vez de excluir.",
      );
    }
    throw e;
  }
}

/**
 * Versão restrita pro próprio usuário editar a si mesmo (ex.: trocar senha).
 * NÃO mexe em role/active — esses só ADMIN via updateUser.
 */
export async function updateOwnProfile(
  id: string,
  input: { name: string; email: string; password: string | null },
) {
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw new BusinessError("Usuário não encontrado.");

  if (current.email !== input.email) {
    const dup = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (dup && dup.id !== id) {
      throw new BusinessError(`Já existe um usuário com o e-mail ${input.email}.`);
    }
  }

  const data: Prisma.UserUpdateInput = { name: input.name, email: input.email };
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 10);

  return prisma.user.update({ where: { id }, data, select: SAFE_SELECT });
}
