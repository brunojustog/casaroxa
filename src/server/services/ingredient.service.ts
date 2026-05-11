import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";
import { BusinessError } from "@/server/auth-helpers";
import { applyIngredientPriceChange } from "./recalculation.service";
import type { IngredientFormData, IngredientListFilters } from "@/schemas/ingredient.schema";

// ---------- Listagem ----------

export async function listIngredients(filters: IngredientListFilters) {
  const where: Prisma.IngredientWhereInput = {};

  if (filters.active === "active") where.active = true;
  else if (filters.active === "inactive") where.active = false;

  if (filters.category) where.category = filters.category;

  if (filters.search && filters.search.trim().length > 0) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { supplier: { contains: filters.search, mode: "insensitive" } },
      { brand: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.ingredient.findMany({
    where,
    orderBy: [{ name: "asc" }],
  });
}

// ---------- Get/detail ----------

export function getIngredientById(id: string) {
  return prisma.ingredient.findUnique({ where: { id } });
}

export function getIngredientByName(name: string) {
  return prisma.ingredient.findUnique({ where: { name } });
}

// ---------- Histórico ----------

export function getIngredientPriceHistory(id: string) {
  return prisma.ingredientPriceHistory.findMany({
    where: { ingredientId: id },
    orderBy: { changedAt: "desc" },
    include: { changedBy: { select: { name: true } } },
    take: 50,
  });
}

// ---------- Onde é usado ----------

export async function getIngredientUsage(id: string) {
  const items = await prisma.recipeItem.findMany({
    where: { ingredientId: id },
    include: {
      recipe: {
        include: { product: { select: { id: true, name: true, category: true } } },
      },
    },
    orderBy: { recipe: { product: { name: "asc" } } },
  });

  // Cada produto pode ter mais de uma linha — agrupa por produto
  const byProduct = new Map<
    string,
    { productId: string; productName: string; category: string; lines: number; totalCost: number }
  >();
  for (const it of items) {
    const p = it.recipe.product;
    const cur = byProduct.get(p.id) ?? {
      productId: p.id,
      productName: p.name,
      category: p.category,
      lines: 0,
      totalCost: 0,
    };
    cur.lines += 1;
    cur.totalCost += Number(it.totalCost);
    byProduct.set(p.id, cur);
  }
  return Array.from(byProduct.values());
}

// ---------- Create ----------

export async function createIngredient(input: IngredientFormData, userId?: string) {
  const existing = await prisma.ingredient.findUnique({
    where: { name: input.name },
    select: { id: true },
  });
  if (existing) throw new BusinessError(`Já existe um ingrediente chamado "${input.name}".`);

  return prisma.ingredient.create({
    data: {
      name: input.name,
      category: input.category,
      unit: input.unit,
      unitCost: input.unitCost,
      packageSize: input.packageSize ?? null,
      packagePrice: input.packagePrice ?? null,
      minStock: input.minStock ?? null,
      supplier: input.supplier,
      brand: input.brand,
      notes: input.notes,
      active: input.active,
      lastPriceAt: new Date(),
      priceHistory: {
        create: {
          oldPrice: 0,
          newPrice: input.unitCost,
          changedById: userId,
        },
      },
    },
  });
}

// ---------- Update ----------

export async function updateIngredient(
  id: string,
  input: IngredientFormData,
  userId?: string,
) {
  const current = await prisma.ingredient.findUnique({ where: { id } });
  if (!current) throw new BusinessError("Ingrediente não encontrado.");

  // Nome único se mudou
  if (current.name !== input.name) {
    const dup = await prisma.ingredient.findUnique({
      where: { name: input.name },
      select: { id: true },
    });
    if (dup && dup.id !== id) {
      throw new BusinessError(`Já existe um ingrediente chamado "${input.name}".`);
    }
  }

  const oldPrice = toDecimal(current.unitCost);
  const newPrice = toDecimal(input.unitCost);
  const priceChanged = !oldPrice.equals(newPrice);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ingredient.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        unit: input.unit,
        unitCost: input.unitCost,
        packageSize: input.packageSize ?? null,
        packagePrice: input.packagePrice ?? null,
        minStock: input.minStock ?? null,
        supplier: input.supplier,
        brand: input.brand,
        notes: input.notes,
        active: input.active,
        lastPriceAt: priceChanged ? new Date() : current.lastPriceAt,
      },
    });

    if (priceChanged) {
      await tx.ingredientPriceHistory.create({
        data: {
          ingredientId: id,
          oldPrice: current.unitCost,
          newPrice: input.unitCost,
          changedById: userId,
        },
      });
      // Cascata centralizada (recalculation.service)
      await applyIngredientPriceChange(tx, id, input.unitCost);
    }

    return updated;
  });
}

// ---------- Soft delete / activate ----------

export async function setIngredientActive(id: string, active: boolean) {
  const ing = await prisma.ingredient.findUnique({ where: { id }, select: { id: true } });
  if (!ing) throw new BusinessError("Ingrediente não encontrado.");
  return prisma.ingredient.update({ where: { id }, data: { active } });
}

// ---------- Hard delete (apenas se não estiver em uso) ----------

export async function deleteIngredient(id: string) {
  const usageCount = await prisma.recipeItem.count({ where: { ingredientId: id } });
  if (usageCount > 0) {
    throw new BusinessError(
      `Este ingrediente está em uso em ${usageCount} ficha(s) técnica(s). Inative-o em vez de excluir.`,
    );
  }
  await prisma.ingredient.delete({ where: { id } });
}
