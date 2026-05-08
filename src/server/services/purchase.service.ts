import { Prisma, type PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";
import { BusinessError } from "@/server/auth-helpers";
import { applyIngredientPriceChange } from "./recalculation.service";
import type {
  PurchaseListFilters,
  SavePurchaseData,
} from "@/schemas/purchase.schema";

// ---------- Listagem ----------

export async function listPurchases(filters: PurchaseListFilters) {
  const where: Prisma.PurchaseWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.supplierId) where.supplierId = filters.supplierId;

  if (filters.search && filters.search.trim().length > 0) {
    where.OR = [
      { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
      { supplier: { name: { contains: filters.search, mode: "insensitive" } } },
      { notes: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.purchase.findMany({
    where,
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    include: {
      supplier: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });
}

export function getPurchaseById(id: string) {
  return prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { include: { ingredient: true }, orderBy: { createdAt: "asc" } },
      user: { select: { name: true } },
    },
  });
}

// ---------- Save (create + update somente em RASCUNHO) ----------

export async function savePurchase(
  input: SavePurchaseData,
  options: { id?: string },
  userId?: string,
) {
  // Carrega ingredientes referenciados
  const ingredientIds = Array.from(new Set(input.items.map((i) => i.ingredientId)));
  const ingredients = ingredientIds.length
    ? await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        select: { id: true, name: true, active: true },
      })
    : [];
  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
  for (const it of input.items) {
    const ing = ingredientMap.get(it.ingredientId);
    if (!ing) throw new BusinessError(`Ingrediente inválido: ${it.ingredientId}`);
    if (!ing.active)
      throw new BusinessError(`Ingrediente "${ing.name}" está inativo.`);
  }

  const total = input.items.reduce(
    (acc, it) => acc + Number(toDecimal(it.quantity).mul(it.unitCost)),
    0,
  );

  return prisma.$transaction(async (tx) => {
    let purchaseId = options.id;

    if (!purchaseId) {
      const created = await tx.purchase.create({
        data: {
          supplierId: input.supplierId,
          invoiceNumber: input.invoiceNumber,
          invoiceDate: input.invoiceDate,
          notes: input.notes,
          totalAmount: total,
          userId: userId ?? null,
        },
      });
      purchaseId = created.id;
    } else {
      const cur = await tx.purchase.findUnique({ where: { id: purchaseId } });
      if (!cur) throw new BusinessError("Compra não encontrada.");
      if (cur.status !== "RASCUNHO") {
        throw new BusinessError(
          "Só é possível editar compras em status RASCUNHO. Cancele e crie outra se necessário.",
        );
      }
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          supplierId: input.supplierId,
          invoiceNumber: input.invoiceNumber,
          invoiceDate: input.invoiceDate,
          notes: input.notes,
          totalAmount: total,
        },
      });
      await tx.purchaseItem.deleteMany({ where: { purchaseId } });
    }

    for (const item of input.items) {
      const itemTotal = toDecimal(item.quantity).mul(item.unitCost).toNumber();
      await tx.purchaseItem.create({
        data: {
          purchaseId,
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: itemTotal,
          lotNumber: item.lotNumber,
          expiryDate: item.expiryDate,
          updateIngredientCost: item.updateIngredientCost,
        },
      });
    }

    return { id: purchaseId, totalAmount: total };
  });
}

// ---------- Confirmar (gera StockMovements + cascata de custo) ----------

export async function confirmPurchase(id: string, userId?: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!purchase) throw new BusinessError("Compra não encontrada.");
  if (purchase.status !== "RASCUNHO") {
    throw new BusinessError(
      `Não é possível confirmar uma compra em status ${purchase.status}.`,
    );
  }
  if (purchase.items.length === 0) {
    throw new BusinessError(
      "Compra sem itens. Adicione ao menos um item antes de confirmar.",
    );
  }

  return prisma.$transaction(async (tx) => {
    // 1. Para cada item, cria StockMovement ENTRADA
    for (const item of purchase.items) {
      await tx.stockMovement.create({
        data: {
          ingredientId: item.ingredientId,
          type: "ENTRADA",
          quantity: item.quantity,
          unitCost: item.unitCost,
          lotNumber: item.lotNumber,
          expiryDate: item.expiryDate,
          notes: `Compra ${purchase.invoiceNumber ?? purchase.id.slice(0, 8)}`,
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          userId: userId ?? null,
        },
      });

      // 2. Se opt-in, atualiza unitCost do ingrediente + cascata
      if (item.updateIngredientCost) {
        const ing = await tx.ingredient.findUnique({
          where: { id: item.ingredientId },
        });
        if (!ing) continue;
        const oldPrice = toDecimal(ing.unitCost);
        const newPrice = toDecimal(item.unitCost);
        if (!oldPrice.equals(newPrice)) {
          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: {
              unitCost: item.unitCost,
              lastPriceAt: new Date(),
            },
          });
          await tx.ingredientPriceHistory.create({
            data: {
              ingredientId: item.ingredientId,
              oldPrice: ing.unitCost,
              newPrice: item.unitCost,
              changedById: userId ?? null,
            },
          });
          await applyIngredientPriceChange(
            tx,
            item.ingredientId,
            Number(item.unitCost),
          );
        }
      }
    }

    // 3. Marca compra como confirmada
    await tx.purchase.update({
      where: { id: purchase.id },
      data: {
        status: "CONFIRMADA",
        confirmedAt: new Date(),
      },
    });

    return purchase.id;
  });
}

// ---------- Cancelar ----------

/**
 * Se RASCUNHO: marca como CANCELADA (não havia movimentos, sem reverter nada).
 * Se CONFIRMADA: marca como CANCELADA + cria movimentos PERDA opostos para zerar
 * o impacto no estoque (não desfaz mudança de custo, pois isso afetaria histórico).
 */
export async function cancelPurchase(id: string, userId?: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!purchase) throw new BusinessError("Compra não encontrada.");
  if (purchase.status === "CANCELADA") {
    throw new BusinessError("Compra já está cancelada.");
  }

  return prisma.$transaction(async (tx) => {
    if (purchase.status === "CONFIRMADA") {
      // Reverter movimentos no estoque com PERDA equivalente
      for (const item of purchase.items) {
        await tx.stockMovement.create({
          data: {
            ingredientId: item.ingredientId,
            type: "PERDA",
            quantity: item.quantity,
            notes: `Estorno de compra ${purchase.invoiceNumber ?? purchase.id.slice(0, 8)}`,
            referenceType: "PURCHASE_CANCEL",
            referenceId: purchase.id,
            userId: userId ?? null,
          },
        });
      }
    }

    await tx.purchase.update({
      where: { id: purchase.id },
      data: {
        status: "CANCELADA",
        cancelledAt: new Date(),
      },
    });

    return purchase.id;
  });
}

// ---------- Hard delete (apenas RASCUNHO) ----------

export async function deletePurchase(id: string) {
  const cur = await prisma.purchase.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!cur) throw new BusinessError("Compra não encontrada.");
  if (cur.status !== "RASCUNHO") {
    throw new BusinessError("Só é possível excluir compras em RASCUNHO. Use cancelar.");
  }
  await prisma.purchase.delete({ where: { id } });
}

// ---------- Status helpers ----------

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  RASCUNHO: "Rascunho",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
};

export const PURCHASE_STATUS_TONE: Record<
  PurchaseStatus,
  "neutral" | "success" | "danger"
> = {
  RASCUNHO: "neutral",
  CONFIRMADA: "success",
  CANCELADA: "danger",
};
