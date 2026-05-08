import { Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";
import { BusinessError } from "@/server/auth-helpers";
import type {
  StockListFilters,
  StockMovementFormData,
} from "@/schemas/stock.schema";

// ---------- Direção do movimento ----------

/** Sinal do movimento: +1 adiciona ao saldo, -1 subtrai. */
export function movementSign(type: StockMovementType): 1 | -1 {
  switch (type) {
    case "ENTRADA":
    case "AJUSTE":
      return 1;
    case "SAIDA":
    case "PERDA":
      return -1;
  }
}

// ---------- Saldo ----------

/**
 * Saldo de um ingrediente: soma assinada de todos os movimentos.
 * Calculado em SQL para ser eficiente quando houver muitos movimentos.
 */
export async function getStockBalance(ingredientId: string): Promise<number> {
  const movements = await prisma.stockMovement.findMany({
    where: { ingredientId },
    select: { type: true, quantity: true },
  });
  return movements.reduce(
    (acc, m) => acc + movementSign(m.type) * Number(m.quantity),
    0,
  );
}

/** Saldo de todos os ingredientes (ativos). Retorna mapa ingredientId → saldo. */
export async function getAllStockBalances(): Promise<Map<string, number>> {
  const movements = await prisma.stockMovement.findMany({
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
  return balances;
}

// ---------- Tipo enriquecido para listagem ----------

export type IngredientStockRow = {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  active: boolean;
  balance: number;
  lastMovementAt: Date | null;
  /** Próxima data de validade (entre as ENTRADAs com expiryDate definido). */
  nextExpiryDate: Date | null;
  /** Movimentos do mês (últimos 30 dias). */
  movementsLast30Days: number;
};

/**
 * Lista ingredientes com saldo + dados úteis para a página /estoque.
 * Filtros:
 *  - search: nome do ingrediente (case-insensitive)
 *  - filter:
 *    - "expiring": ingredientes com nextExpiryDate em até 7 dias
 *    - "empty": ingredientes com saldo zerado/negativo MAS usados em fichas
 *    - "all": todos ativos
 */
export async function listStockOverview(
  filters: StockListFilters,
): Promise<IngredientStockRow[]> {
  const where: Prisma.IngredientWhereInput = { active: true };
  if (filters.search && filters.search.trim().length > 0) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  const ingredients = await prisma.ingredient.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      stockMovements: {
        select: { type: true, quantity: true, expiryDate: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { recipeItems: true } },
    },
  });

  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const rows: IngredientStockRow[] = ingredients.map((ing) => {
    const movs = ing.stockMovements;
    const balance = movs.reduce(
      (acc, m) => acc + movementSign(m.type) * Number(m.quantity),
      0,
    );
    const lastMovementAt = movs[0]?.createdAt ?? null;

    // Próxima validade: menor expiryDate >= hoje entre os movimentos com saldo positivo
    const futureExpiries = movs
      .filter((m) => m.expiryDate && m.expiryDate >= now)
      .map((m) => m.expiryDate as Date)
      .sort((a, b) => a.getTime() - b.getTime());
    const nextExpiryDate = futureExpiries[0] ?? null;

    const movementsLast30Days = movs.filter((m) => m.createdAt >= last30).length;

    return {
      id: ing.id,
      name: ing.name,
      category: ing.category,
      unit: ing.unit,
      unitCost: Number(ing.unitCost),
      active: ing.active,
      balance,
      lastMovementAt,
      nextExpiryDate,
      movementsLast30Days,
    };
  });

  // Filtros derivados
  if (filters.filter === "expiring") {
    return rows.filter(
      (r) => r.nextExpiryDate && r.nextExpiryDate <= sevenDays,
    );
  }
  if (filters.filter === "empty") {
    const usedInRecipes = new Set(
      ingredients.filter((i) => i._count.recipeItems > 0).map((i) => i.id),
    );
    return rows.filter((r) => r.balance <= 0 && usedInRecipes.has(r.id));
  }
  return rows;
}

// ---------- Histórico de movimentos ----------

export async function listMovementsByIngredient(ingredientId: string, limit = 100) {
  return prisma.stockMovement.findMany({
    where: { ingredientId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });
}

// ---------- Registrar movimento ----------

export async function registerStockMovement(
  input: StockMovementFormData,
  userId?: string,
): Promise<{ id: string; balance: number }> {
  const ing = await prisma.ingredient.findUnique({
    where: { id: input.ingredientId },
    select: { id: true, name: true, active: true },
  });
  if (!ing) throw new BusinessError("Ingrediente não encontrado.");
  if (!ing.active) throw new BusinessError(`Ingrediente "${ing.name}" está inativo.`);

  const movement = await prisma.stockMovement.create({
    data: {
      ingredientId: input.ingredientId,
      type: input.type,
      quantity: input.quantity,
      unitCost: input.unitCost ?? null,
      lotNumber: input.lotNumber,
      expiryDate: input.expiryDate,
      notes: input.notes,
      referenceType: "MANUAL",
      userId: userId ?? null,
    },
  });

  const balance = await getStockBalance(input.ingredientId);
  return { id: movement.id, balance };
}

// ---------- Métricas para dashboard ----------

export async function countMovementsLast30Days(): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return prisma.stockMovement.count({ where: { createdAt: { gte: since } } });
}

export async function countExpiringSoon(daysThreshold = 7): Promise<number> {
  const now = new Date();
  const limit = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

  // Conta ingredientes distintos cuja próxima validade ≤ limit AND >= now
  // E que ainda têm saldo positivo (caso contrário, não temos o lote).
  const rows = await prisma.ingredient.findMany({
    where: { active: true },
    select: {
      id: true,
      stockMovements: {
        select: { type: true, quantity: true, expiryDate: true },
      },
    },
  });

  let count = 0;
  for (const ing of rows) {
    const balance = ing.stockMovements.reduce(
      (acc, m) => acc + movementSign(m.type) * Number(m.quantity),
      0,
    );
    if (balance <= 0) continue;
    const upcoming = ing.stockMovements
      .filter((m) => m.expiryDate && m.expiryDate >= now && m.expiryDate <= limit)
      .length;
    if (upcoming > 0) count += 1;
  }
  return count;
}

export async function countEmptyButUsed(): Promise<number> {
  const ingredients = await prisma.ingredient.findMany({
    where: { active: true },
    select: {
      id: true,
      stockMovements: { select: { type: true, quantity: true } },
      _count: { select: { recipeItems: true } },
    },
  });
  let count = 0;
  for (const ing of ingredients) {
    if (ing._count.recipeItems === 0) continue;
    const balance = ing.stockMovements.reduce(
      (acc, m) => acc + movementSign(m.type) * Number(m.quantity),
      0,
    );
    if (balance <= 0) count += 1;
  }
  return count;
}

// ---------- Util para forms ----------

export async function getActiveIngredientsForStock() {
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

export function getIngredient(id: string) {
  return prisma.ingredient.findUnique({ where: { id } });
}

/** Movimentos com mais detalhes (usado em /estoque/[ingredientId]). */
export type MovementWithUser = Prisma.StockMovementGetPayload<{
  include: { user: { select: { name: true } } };
}>;
