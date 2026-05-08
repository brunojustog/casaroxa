import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";
import { BusinessError } from "@/server/auth-helpers";
import type {
  ProductFormData,
  ProductListFilters,
} from "@/schemas/product.schema";

// ---------- Listagem ----------

export async function listProducts(filters: ProductListFilters) {
  const where: Prisma.ProductWhereInput = {};

  if (filters.active === "active") where.active = true;
  else if (filters.active === "inactive") where.active = false;

  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;

  if (filters.search && filters.search.trim().length > 0) {
    where.OR = [{ name: { contains: filters.search, mode: "insensitive" } }];
  }

  return prisma.product.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      recipe: { select: { id: true, reviewed: true } },
      _count: { select: { comboItems: true } },
    },
  });
}

export type ProductListItem = Awaited<ReturnType<typeof listProducts>>[number];

// ---------- Get/detail ----------

export function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      recipe: {
        include: {
          items: { include: { ingredient: true }, orderBy: { createdAt: "asc" } },
        },
      },
      _count: { select: { comboItems: true } },
    },
  });
}

export function getProductPriceHistory(id: string) {
  return prisma.productPriceHistory.findMany({
    where: { productId: id },
    orderBy: { changedAt: "desc" },
    take: 50,
  });
}

// ---------- Create ----------

export async function createProduct(input: ProductFormData) {
  const dup = await prisma.product.findUnique({
    where: { name: input.name },
    select: { id: true },
  });
  if (dup) throw new BusinessError(`Já existe um produto chamado "${input.name}".`);

  return prisma.product.create({
    data: {
      name: input.name,
      category: input.category,
      type: input.type,
      portionLabel: input.portionLabel,
      salePrice: input.salePrice ?? null,
      targetCmv: input.targetCmv ?? null,
      description: input.description,
      notes: input.notes,
      status: input.status,
      active: input.active,
      imageUrl: input.imageUrl,
      showInMenu: input.showInMenu,
      priceHistory: input.salePrice
        ? { create: { oldPrice: null, newPrice: input.salePrice } }
        : undefined,
    },
  });
}

// ---------- Update ----------

export async function updateProduct(id: string, input: ProductFormData) {
  const current = await prisma.product.findUnique({ where: { id } });
  if (!current) throw new BusinessError("Produto não encontrado.");

  if (current.name !== input.name) {
    const dup = await prisma.product.findUnique({
      where: { name: input.name },
      select: { id: true },
    });
    if (dup && dup.id !== id) {
      throw new BusinessError(`Já existe um produto chamado "${input.name}".`);
    }
  }

  const oldPrice = current.salePrice ? toDecimal(current.salePrice) : null;
  const newPrice = input.salePrice ?? null;
  const priceChanged =
    (oldPrice === null && newPrice !== null) ||
    (oldPrice !== null && newPrice === null) ||
    (oldPrice !== null && newPrice !== null && !oldPrice.equals(newPrice));

  return prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        type: input.type,
        portionLabel: input.portionLabel,
        salePrice: input.salePrice ?? null,
        targetCmv: input.targetCmv ?? null,
        description: input.description,
        notes: input.notes,
        status: input.status,
        active: input.active,
        imageUrl: input.imageUrl,
        showInMenu: input.showInMenu,
      },
    });

    if (priceChanged) {
      await tx.productPriceHistory.create({
        data: {
          productId: id,
          oldPrice: current.salePrice,
          newPrice: input.salePrice ?? null,
        },
      });
    }

    return updated;
  });
}

// ---------- Aplicar preço (vindo do simulador) ----------

export async function setProductSalePrice(id: string, newPrice: number) {
  const current = await prisma.product.findUnique({ where: { id } });
  if (!current) throw new BusinessError("Produto não encontrado.");

  const oldPrice = current.salePrice ? toDecimal(current.salePrice) : null;
  const changed =
    (oldPrice === null) || !oldPrice.equals(newPrice);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: { salePrice: newPrice },
    });
    if (changed) {
      await tx.productPriceHistory.create({
        data: {
          productId: id,
          oldPrice: current.salePrice,
          newPrice,
        },
      });
    }
    return updated;
  });
}

// ---------- Soft activate/deactivate ----------

export async function setProductActive(id: string, active: boolean) {
  const p = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!p) throw new BusinessError("Produto não encontrado.");
  return prisma.product.update({ where: { id }, data: { active } });
}

// ---------- Hard delete ----------

export async function deleteProduct(id: string) {
  const [comboCount, recipeItems] = await Promise.all([
    prisma.comboItem.count({ where: { productId: id } }),
    prisma.recipeItem.count({ where: { recipe: { productId: id } } }),
  ]);

  if (comboCount > 0) {
    throw new BusinessError(
      `Este produto está em ${comboCount} combo(s). Inative-o em vez de excluir.`,
    );
  }
  if (recipeItems > 0) {
    throw new BusinessError(
      "Este produto tem ficha técnica com ingredientes. Remova os itens da ficha antes de excluir.",
    );
  }

  await prisma.product.delete({ where: { id } });
}

// ---------- Duplicar ----------

export async function duplicateProduct(id: string) {
  const original = await prisma.product.findUnique({
    where: { id },
    include: { recipe: { include: { items: true } } },
  });
  if (!original) throw new BusinessError("Produto não encontrado.");

  // Garante nome único: appendizing "(cópia)" e número se necessário
  let name = `${original.name} (cópia)`;
  let suffix = 2;
  while (await prisma.product.findUnique({ where: { name }, select: { id: true } })) {
    name = `${original.name} (cópia ${suffix++})`;
  }

  return prisma.$transaction(async (tx) => {
    const copy = await tx.product.create({
      data: {
        name,
        category: original.category,
        type: original.type,
        portionLabel: original.portionLabel,
        salePrice: original.salePrice,
        targetCmv: original.targetCmv,
        description: original.description,
        notes: original.notes,
        status: "INATIVO", // cópia começa inativa para revisão
        active: true,
        totalCost: original.totalCost,
      },
    });

    if (original.recipe) {
      const newRecipe = await tx.recipe.create({
        data: {
          productId: copy.id,
          totalCost: original.recipe.totalCost,
          reviewed: false,
          notes: original.recipe.notes,
        },
      });

      for (const item of original.recipe.items) {
        await tx.recipeItem.create({
          data: {
            recipeId: newRecipe.id,
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unit: item.unit,
            unitCostSnapshot: item.unitCostSnapshot,
            totalCost: item.totalCost,
            notes: item.notes,
          },
        });
      }
    }

    return copy;
  });
}
