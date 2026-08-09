import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";
import { slugify } from "@/lib/slug";
import { BusinessError } from "@/server/auth-helpers";

/** Slug único a partir do nome (colisão ganha sufixo -2, -3…). */
async function uniqueComboSlug(name: string): Promise<string> {
  const base = slugify(name) || "combo";
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const dup = await prisma.combo.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!dup) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}
import type {
  ComboListFilters,
  SaveComboData,
} from "@/schemas/combo.schema";

// ---------- Listagem ----------

export async function listCombos(filters: ComboListFilters) {
  const where: Prisma.ComboWhereInput = {};

  if (filters.active === "active") where.active = true;
  else if (filters.active === "inactive") where.active = false;

  if (filters.category) where.category = filters.category;

  if (filters.search && filters.search.trim().length > 0) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  return prisma.combo.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: true } } },
  });
}

// ---------- Detalhe ----------

export function getComboById(id: string) {
  return prisma.combo.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function getActiveProductsForCombos() {
  return prisma.product.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      portionLabel: true,
      totalCost: true,
      salePrice: true,
    },
  });
}

// ---------- Save (create + update) ----------

export async function saveCombo(input: SaveComboData, options: { id?: string }) {
  // Valida nome único
  const existingByName = await prisma.combo.findUnique({
    where: { name: input.name },
    select: { id: true },
  });
  if (existingByName && existingByName.id !== options.id) {
    throw new BusinessError(`Já existe um combo chamado "${input.name}".`);
  }

  // Carrega produtos referenciados
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, totalCost: true, name: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const it of input.items) {
    if (!productMap.has(it.productId)) {
      throw new BusinessError(`Produto inválido: ${it.productId}`);
    }
  }

  return prisma.$transaction(async (tx) => {
    let comboId = options.id;

    if (!comboId) {
      const created = await tx.combo.create({
        data: {
          name: input.name,
          slug: await uniqueComboSlug(input.name),
          category: input.category,
          description: input.description,
          salePrice: input.salePrice ?? null,
          targetCmv: input.targetCmv ?? null,
          notes: input.notes,
          active: input.active,
          imageUrl: input.imageUrl,
          showInMenu: input.showInMenu,
          requiresKitchen: input.requiresKitchen,
          ingredientsPublic: input.ingredientsPublic,
          gallery: input.gallery ?? Prisma.DbNull,
          youtubeUrl: input.youtubeUrl,
        },
      });
      comboId = created.id;
    } else {
      await tx.combo.update({
        where: { id: comboId },
        data: {
          name: input.name,
          category: input.category,
          description: input.description,
          salePrice: input.salePrice ?? null,
          targetCmv: input.targetCmv ?? null,
          notes: input.notes,
          active: input.active,
          imageUrl: input.imageUrl,
          showInMenu: input.showInMenu,
          requiresKitchen: input.requiresKitchen,
          ingredientsPublic: input.ingredientsPublic,
          gallery: input.gallery ?? Prisma.DbNull,
          youtubeUrl: input.youtubeUrl,
        },
      });
      // Limpa itens anteriores
      await tx.comboItem.deleteMany({ where: { comboId } });
    }

    let total = 0;
    for (const item of input.items) {
      const prod = productMap.get(item.productId)!;
      const unitCost = Number(prod.totalCost);
      const totalCost = toDecimal(item.quantity).mul(unitCost).toNumber();
      total += totalCost;

      await tx.comboItem.create({
        data: {
          comboId,
          productId: prod.id,
          quantity: item.quantity,
          unitCostSnapshot: unitCost,
          totalCost,
        },
      });
    }

    await tx.combo.update({
      where: { id: comboId },
      data: { totalCost: total },
    });

    return { id: comboId, totalCost: total };
  });
}

// ---------- Aplicar preço (vindo do simulador) ----------

export async function setComboSalePrice(id: string, newPrice: number) {
  const c = await prisma.combo.findUnique({ where: { id }, select: { id: true } });
  if (!c) throw new BusinessError("Combo não encontrado.");
  return prisma.combo.update({ where: { id }, data: { salePrice: newPrice } });
}

// ---------- Soft active ----------

export async function setComboActive(id: string, active: boolean) {
  const c = await prisma.combo.findUnique({ where: { id }, select: { id: true } });
  if (!c) throw new BusinessError("Combo não encontrado.");
  return prisma.combo.update({ where: { id }, data: { active } });
}

export async function setComboShowInMenu(id: string, show: boolean) {
  const c = await prisma.combo.findUnique({ where: { id }, select: { id: true } });
  if (!c) throw new BusinessError("Combo não encontrado.");
  return prisma.combo.update({ where: { id }, data: { showInMenu: show } });
}

// ---------- Hard delete ----------

export async function deleteCombo(id: string) {
  // Combos não são referenciados por nada — pode deletar direto.
  await prisma.combo.delete({ where: { id } });
}

// ---------- Duplicar ----------

export async function duplicateCombo(id: string) {
  const original = await prisma.combo.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!original) throw new BusinessError("Combo não encontrado.");

  let name = `${original.name} (cópia)`;
  let suffix = 2;
  while (await prisma.combo.findUnique({ where: { name }, select: { id: true } })) {
    name = `${original.name} (cópia ${suffix++})`;
  }

  return prisma.$transaction(async (tx) => {
    const copy = await tx.combo.create({
      data: {
        name,
        category: original.category,
        description: original.description,
        salePrice: original.salePrice,
        targetCmv: original.targetCmv,
        notes: original.notes,
        active: false, // cópia começa inativa para revisão
        totalCost: original.totalCost,
      },
    });
    for (const item of original.items) {
      await tx.comboItem.create({
        data: {
          comboId: copy.id,
          productId: item.productId,
          quantity: item.quantity,
          unitCostSnapshot: item.unitCostSnapshot,
          totalCost: item.totalCost,
        },
      });
    }
    return copy;
  });
}
