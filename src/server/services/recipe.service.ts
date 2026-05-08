import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";
import { BusinessError } from "@/server/auth-helpers";
import { cascadeProductCostToCombos } from "./recalculation.service";
import type {
  RecipeListFilters,
  SaveRecipeData,
} from "@/schemas/recipe.schema";

// ---------- Listagem geral (todos os produtos com sua ficha) ----------

export async function listProductsForRecipes(filters: RecipeListFilters) {
  const where: Prisma.ProductWhereInput = { active: true };

  if (filters.search && filters.search.trim().length > 0) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      recipe: {
        select: {
          id: true,
          reviewed: true,
          reviewedAt: true,
          updatedAt: true,
          totalCost: true,
          _count: { select: { items: true } },
        },
      },
    },
  });

  return products.filter((p) => {
    switch (filters.status) {
      case "no_recipe":
        return !p.recipe || p.recipe._count.items === 0;
      case "needs_review":
        return p.recipe && p.recipe._count.items > 0 && !p.recipe.reviewed;
      case "reviewed":
        return p.recipe && p.recipe.reviewed;
      default:
        return true;
    }
  });
}

// ---------- Detalhe da ficha técnica ----------

export function getRecipeForProduct(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      recipe: {
        include: {
          items: {
            include: { ingredient: true },
            orderBy: { createdAt: "asc" },
          },
          versions: { orderBy: { version: "desc" }, take: 20 },
          reviewedBy: { select: { name: true } },
        },
      },
    },
  });
}

export async function getActiveIngredients() {
  return prisma.ingredient.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      unit: true,
      unitCost: true,
    },
  });
}

// ---------- Save (substitui todos os items + cascata) ----------

export async function saveRecipe(input: SaveRecipeData) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new BusinessError("Produto não encontrado.");

  // Carrega ingredientes referenciados de uma vez para validar e snapshot
  const ingredientIds = Array.from(new Set(input.items.map((i) => i.ingredientId)));
  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: ingredientIds } },
  });
  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

  for (const it of input.items) {
    if (!ingredientMap.has(it.ingredientId)) {
      throw new BusinessError(`Ingrediente inválido: ${it.ingredientId}`);
    }
  }

  return prisma.$transaction(async (tx) => {
    // Garante recipe (cria se ainda não existe).
    // Edições zeram a flag de revisão — precisa re-aprovar depois.
    const recipe = await tx.recipe.upsert({
      where: { productId: input.productId },
      update: {
        responsible: input.responsible,
        notes: input.notes,
        reviewed: false,
        reviewedAt: null,
        reviewedById: null,
      },
      create: {
        productId: input.productId,
        responsible: input.responsible,
        notes: input.notes,
      },
    });

    // Substitui itens
    await tx.recipeItem.deleteMany({ where: { recipeId: recipe.id } });

    let recipeTotal = 0;
    for (const item of input.items) {
      const ing = ingredientMap.get(item.ingredientId)!;
      const unitCost = Number(ing.unitCost);
      const totalCost = toDecimal(item.quantity).mul(unitCost).toNumber();
      recipeTotal += totalCost;
      await tx.recipeItem.create({
        data: {
          recipeId: recipe.id,
          ingredientId: ing.id,
          quantity: item.quantity,
          unit: ing.unit,
          unitCostSnapshot: unitCost,
          totalCost,
          notes: item.notes,
        },
      });
    }

    // Atualiza totais e cascata
    await tx.recipe.update({
      where: { id: recipe.id },
      data: { totalCost: recipeTotal },
    });
    await tx.product.update({
      where: { id: input.productId },
      data: { totalCost: recipeTotal },
    });

    await cascadeProductCostToCombos(tx, input.productId, recipeTotal);

    return recipe;
  });
}

// ---------- Marcar revisada ----------

export async function setRecipeReviewed(productId: string, reviewed: boolean, userId: string) {
  const recipe = await prisma.recipe.findUnique({ where: { productId } });
  if (!recipe) throw new BusinessError("Esta ficha técnica ainda não existe. Salve antes de marcar como revisada.");

  return prisma.recipe.update({
    where: { id: recipe.id },
    data: {
      reviewed,
      reviewedAt: reviewed ? new Date() : null,
      reviewedById: reviewed ? userId : null,
    },
  });
}

// ---------- Versões ----------

type RecipeSnapshot = {
  productId: string;
  totalCost: number;
  responsible: string | null;
  notes: string | null;
  items: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    unitCostSnapshot: number;
    totalCost: number;
    notes: string | null;
  }>;
};

export async function saveRecipeVersion(productId: string, notes?: string | null) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { recipe: { include: { items: { include: { ingredient: true } } } } },
  });
  if (!product || !product.recipe) {
    throw new BusinessError("Esta ficha técnica ainda não existe.");
  }

  const last = await prisma.recipeVersion.findFirst({
    where: { recipeId: product.recipe.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (last?.version ?? 0) + 1;

  const snapshot: RecipeSnapshot = {
    productId,
    totalCost: Number(product.recipe.totalCost),
    responsible: product.recipe.responsible,
    notes: product.recipe.notes,
    items: product.recipe.items.map((it) => ({
      ingredientId: it.ingredientId,
      ingredientName: it.ingredient.name,
      quantity: Number(it.quantity),
      unit: it.unit,
      unitCostSnapshot: Number(it.unitCostSnapshot),
      totalCost: Number(it.totalCost),
      notes: it.notes,
    })),
  };

  return prisma.recipeVersion.create({
    data: {
      recipeId: product.recipe.id,
      version: nextVersion,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      notes: notes ?? null,
    },
  });
}

export function getRecipeVersions(recipeId: string) {
  return prisma.recipeVersion.findMany({
    where: { recipeId },
    orderBy: { version: "desc" },
  });
}
