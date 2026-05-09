import {
  InventoryStatus,
  Prisma,
  StockMovementType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";
import { BusinessError } from "@/server/auth-helpers";
import { getStockBalance, movementSign } from "./stock.service";
import type {
  InventoryCreateData,
  InventoryItemCountData,
  InventoryListFilters,
} from "@/schemas/inventory.schema";

const REFERENCE_TYPE_INVENTORY = "INVENTORY";

// ---------- Listagem ----------

export async function listInventories(filters: InventoryListFilters) {
  const where: Prisma.InventoryWhereInput = {};
  if (filters.status !== "all") where.status = filters.status;

  return prisma.inventory.findMany({
    where,
    orderBy: { startedAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
    take: 100,
  });
}

export async function getInventoryById(id: string) {
  return prisma.inventory.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      items: {
        orderBy: [{ ingredient: { category: "asc" } }, { ingredient: { name: "asc" } }],
        include: {
          ingredient: {
            select: { id: true, name: true, unit: true, category: true, active: true },
          },
          countedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
}

// ---------- Criação ----------

/**
 * Cria a sessão de contagem. Se `populateAllActive`, preenche com todos os
 * ingredientes ativos, fazendo snapshot do saldo e custo unit. atual.
 */
export async function createInventory(
  input: InventoryCreateData,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.inventory.create({
      data: {
        name: input.name,
        notes: input.notes,
        status: InventoryStatus.ABERTA,
        createdById: userId,
      },
    });

    if (!input.populateAllActive) return inv;

    const ingredients = await tx.ingredient.findMany({
      where: { active: true },
      select: { id: true, unitCost: true },
    });
    if (ingredients.length === 0) return inv;

    // Saldo de todos os ingredientes em uma query (mais eficiente).
    const movements = await tx.stockMovement.findMany({
      where: { ingredientId: { in: ingredients.map((i) => i.id) } },
      select: { ingredientId: true, type: true, quantity: true },
    });
    const balances = new Map<string, number>();
    for (const m of movements) {
      const cur = balances.get(m.ingredientId) ?? 0;
      balances.set(
        m.ingredientId,
        cur + movementSign(m.type) * Number(m.quantity),
      );
    }

    await tx.inventoryItem.createMany({
      data: ingredients.map((ing) => ({
        inventoryId: inv.id,
        ingredientId: ing.id,
        expectedQuantity: toDecimal(balances.get(ing.id) ?? 0).toString(),
        unitCostSnapshot: ing.unitCost,
      })),
    });

    return inv;
  });
}

async function ensureOpenInventory(id: string) {
  const inv = await prisma.inventory.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!inv) throw new BusinessError("Contagem não encontrada.");
  if (inv.status !== InventoryStatus.ABERTA) {
    throw new BusinessError("Esta contagem já foi fechada ou cancelada.");
  }
  return inv;
}

// ---------- Adicionar / remover itens ----------

export async function addInventoryItem(
  inventoryId: string,
  ingredientId: string,
) {
  await ensureOpenInventory(inventoryId);

  const ing = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
    select: { id: true, name: true, active: true, unitCost: true },
  });
  if (!ing) throw new BusinessError("Ingrediente não encontrado.");
  if (!ing.active) {
    throw new BusinessError(`Ingrediente "${ing.name}" está inativo.`);
  }

  const dup = await prisma.inventoryItem.findUnique({
    where: { inventoryId_ingredientId: { inventoryId, ingredientId } },
    select: { id: true },
  });
  if (dup) throw new BusinessError("Este ingrediente já está na contagem.");

  const balance = await getStockBalance(ingredientId);

  return prisma.inventoryItem.create({
    data: {
      inventoryId,
      ingredientId,
      expectedQuantity: toDecimal(balance).toString(),
      unitCostSnapshot: ing.unitCost,
    },
  });
}

export async function removeInventoryItem(itemId: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    select: { id: true, inventory: { select: { status: true } } },
  });
  if (!item) throw new BusinessError("Item da contagem não encontrado.");
  if (item.inventory.status !== InventoryStatus.ABERTA) {
    throw new BusinessError("Não dá pra remover itens de contagem fechada.");
  }
  await prisma.inventoryItem.delete({ where: { id: itemId } });
}

// ---------- Contagem (registrar quantidade) ----------

export async function countInventoryItem(
  itemId: string,
  input: InventoryItemCountData,
  userId: string,
) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    select: { id: true, inventory: { select: { status: true } } },
  });
  if (!item) throw new BusinessError("Item da contagem não encontrado.");
  if (item.inventory.status !== InventoryStatus.ABERTA) {
    throw new BusinessError("Esta contagem já foi fechada.");
  }

  return prisma.inventoryItem.update({
    where: { id: itemId },
    data: {
      countedQuantity: toDecimal(input.countedQuantity).toString(),
      notes: input.notes,
      countedAt: new Date(),
      countedById: userId,
    },
  });
}

// ---------- Cancelar ----------

export async function cancelInventory(id: string) {
  await ensureOpenInventory(id);
  return prisma.inventory.update({
    where: { id },
    data: { status: InventoryStatus.CANCELADA, closedAt: new Date() },
  });
}

// ---------- Fechar (gera StockMovements) ----------

/**
 * Fecha a contagem e gera, em transação:
 *   - Pra cada item contado com diff != 0:
 *     - diff > 0 → AJUSTE (sobra) com quantity = diff
 *     - diff < 0 → PERDA  (falta) com quantity = |diff|
 *   - referenceType="INVENTORY", referenceId=inventory.id
 *
 * Itens não contados (countedQuantity = null) são ignorados.
 * Se nenhum item foi contado, falha — não vamos fechar contagem vazia.
 */
export async function closeInventory(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.inventory.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!inv) throw new BusinessError("Contagem não encontrada.");
    if (inv.status !== InventoryStatus.ABERTA) {
      throw new BusinessError("Esta contagem já foi fechada ou cancelada.");
    }

    const counted = inv.items.filter((i) => i.countedQuantity !== null);
    if (counted.length === 0) {
      throw new BusinessError(
        "Nenhum item foi contado. Conte pelo menos um item antes de fechar.",
      );
    }

    let movementsCreated = 0;
    for (const item of counted) {
      const expected = toDecimal(item.expectedQuantity);
      const actual = toDecimal(item.countedQuantity ?? 0);
      const diff = actual.minus(expected);
      if (diff.isZero()) continue;

      const isSurplus = diff.greaterThan(0);
      await tx.stockMovement.create({
        data: {
          ingredientId: item.ingredientId,
          type: isSurplus
            ? StockMovementType.AJUSTE
            : StockMovementType.PERDA,
          quantity: diff.abs().toString(),
          unitCost: item.unitCostSnapshot,
          notes: `Inventário "${inv.name}"${item.notes ? ` — ${item.notes}` : ""}`,
          referenceType: REFERENCE_TYPE_INVENTORY,
          referenceId: inv.id,
          userId,
        },
      });
      movementsCreated += 1;
    }

    const closed = await tx.inventory.update({
      where: { id },
      data: {
        status: InventoryStatus.FECHADA,
        closedAt: new Date(),
        closedById: userId,
      },
    });
    return { inventory: closed, movementsCreated };
  });
}
