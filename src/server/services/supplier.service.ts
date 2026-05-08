import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import type {
  SupplierFormData,
  SupplierListFilters,
} from "@/schemas/supplier.schema";

export async function listSuppliers(filters: SupplierListFilters) {
  const where: Prisma.SupplierWhereInput = {};
  if (filters.active === "active") where.active = true;
  else if (filters.active === "inactive") where.active = false;

  if (filters.search && filters.search.trim().length > 0) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { cnpj: { contains: filters.search } },
      { contactPerson: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { purchases: true } } },
  });
}

export function getSupplierById(id: string) {
  return prisma.supplier.findUnique({ where: { id } });
}

export function listActiveSuppliers() {
  return prisma.supplier.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function createSupplier(input: SupplierFormData) {
  const dup = await prisma.supplier.findUnique({
    where: { name: input.name },
    select: { id: true },
  });
  if (dup) throw new BusinessError(`Já existe um fornecedor chamado "${input.name}".`);

  if (input.cnpj) {
    const dupCnpj = await prisma.supplier.findUnique({
      where: { cnpj: input.cnpj },
      select: { id: true },
    });
    if (dupCnpj) throw new BusinessError(`Já existe um fornecedor com o CNPJ ${input.cnpj}.`);
  }

  return prisma.supplier.create({
    data: {
      name: input.name,
      cnpj: input.cnpj,
      contactPerson: input.contactPerson,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
      active: input.active,
    },
  });
}

export async function updateSupplier(id: string, input: SupplierFormData) {
  const current = await prisma.supplier.findUnique({ where: { id } });
  if (!current) throw new BusinessError("Fornecedor não encontrado.");

  if (current.name !== input.name) {
    const dup = await prisma.supplier.findUnique({
      where: { name: input.name },
      select: { id: true },
    });
    if (dup && dup.id !== id) {
      throw new BusinessError(`Já existe um fornecedor chamado "${input.name}".`);
    }
  }
  if (input.cnpj && current.cnpj !== input.cnpj) {
    const dupCnpj = await prisma.supplier.findUnique({
      where: { cnpj: input.cnpj },
      select: { id: true },
    });
    if (dupCnpj && dupCnpj.id !== id) {
      throw new BusinessError(`Já existe um fornecedor com o CNPJ ${input.cnpj}.`);
    }
  }

  return prisma.supplier.update({
    where: { id },
    data: {
      name: input.name,
      cnpj: input.cnpj,
      contactPerson: input.contactPerson,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
      active: input.active,
    },
  });
}

export async function setSupplierActive(id: string, active: boolean) {
  const s = await prisma.supplier.findUnique({ where: { id }, select: { id: true } });
  if (!s) throw new BusinessError("Fornecedor não encontrado.");
  return prisma.supplier.update({ where: { id }, data: { active } });
}

export async function deleteSupplier(id: string) {
  const count = await prisma.purchase.count({ where: { supplierId: id } });
  if (count > 0) {
    throw new BusinessError(
      `Este fornecedor está em ${count} compra(s). Inative-o em vez de excluir.`,
    );
  }
  await prisma.supplier.delete({ where: { id } });
}
