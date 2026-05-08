import { Prisma, FixedCostCategory, FixedCostFrequency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { sumActiveMonthly } from "@/domain/fixed-costs";
import type {
  FixedCostItemFormData,
  FixedCostListFilters,
} from "@/schemas/fixed-cost.schema";

type Tx = Prisma.TransactionClient;

export async function listFixedCostItems(filters: FixedCostListFilters) {
  const where: Prisma.FixedCostItemWhereInput = {};
  if (filters.active === "active") where.active = true;
  else if (filters.active === "inactive") where.active = false;
  if (filters.category && filters.category !== "all") {
    where.category = filters.category;
  }
  if (filters.search && filters.search.trim().length > 0) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { notes: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.fixedCostItem.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export function getFixedCostItemById(id: string) {
  return prisma.fixedCostItem.findUnique({
    where: { id },
    include: {
      history: {
        orderBy: { changedAt: "desc" },
        take: 30,
        include: { changedBy: { select: { name: true } } },
      },
    },
  });
}

export async function getMonthlyTotal() {
  const items = await prisma.fixedCostItem.findMany({
    where: { active: true },
    select: { amount: true, frequency: true, active: true },
  });
  return sumActiveMonthly(items);
}

/** Recalcula o cache em Settings.fixedMonthlyCost a partir dos itens ativos. */
async function recomputeAndPersistMonthlyTotal(tx: Tx) {
  const items = await tx.fixedCostItem.findMany({
    where: { active: true },
    select: { amount: true, frequency: true, active: true },
  });
  const total = sumActiveMonthly(items).toFixed(2);
  await tx.settings.upsert({
    where: { id: 1 },
    update: { fixedMonthlyCost: total },
    create: { id: 1, fixedMonthlyCost: total },
  });
}

export async function createFixedCostItem(
  input: FixedCostItemFormData,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.fixedCostItem.create({
      data: {
        name: input.name,
        category: input.category,
        frequency: input.frequency,
        amount: input.amount.toFixed(2),
        notes: input.notes,
        active: input.active,
        createdById: userId,
      },
    });
    await recomputeAndPersistMonthlyTotal(tx);
    return created;
  });
}

export async function updateFixedCostItem(
  id: string,
  input: FixedCostItemFormData,
  userId: string,
) {
  const current = await prisma.fixedCostItem.findUnique({ where: { id } });
  if (!current) throw new BusinessError("Item de custo fixo não encontrado.");

  const newAmountStr = input.amount.toFixed(2);
  const oldAmountStr = current.amount.toString();
  const valueChanged =
    oldAmountStr !== newAmountStr ||
    current.frequency !== input.frequency ||
    current.active !== input.active;

  return prisma.$transaction(async (tx) => {
    if (valueChanged) {
      await tx.fixedCostItemHistory.create({
        data: {
          itemId: id,
          oldAmount: current.amount,
          newAmount: newAmountStr,
          oldFrequency: current.frequency,
          newFrequency: input.frequency,
          oldActive: current.active,
          newActive: input.active,
          changedById: userId,
        },
      });
    }

    const updated = await tx.fixedCostItem.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        frequency: input.frequency,
        amount: newAmountStr,
        notes: input.notes,
        active: input.active,
      },
    });
    await recomputeAndPersistMonthlyTotal(tx);
    return updated;
  });
}

export async function setFixedCostItemActive(
  id: string,
  active: boolean,
  userId: string,
) {
  const current = await prisma.fixedCostItem.findUnique({ where: { id } });
  if (!current) throw new BusinessError("Item de custo fixo não encontrado.");
  if (current.active === active) return current;

  return prisma.$transaction(async (tx) => {
    await tx.fixedCostItemHistory.create({
      data: {
        itemId: id,
        oldAmount: current.amount,
        newAmount: current.amount,
        oldFrequency: current.frequency,
        newFrequency: current.frequency,
        oldActive: current.active,
        newActive: active,
        changedById: userId,
      },
    });
    const updated = await tx.fixedCostItem.update({
      where: { id },
      data: { active },
    });
    await recomputeAndPersistMonthlyTotal(tx);
    return updated;
  });
}

export async function deleteFixedCostItem(id: string) {
  const current = await prisma.fixedCostItem.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!current) throw new BusinessError("Item de custo fixo não encontrado.");

  return prisma.$transaction(async (tx) => {
    await tx.fixedCostItem.delete({ where: { id } });
    await recomputeAndPersistMonthlyTotal(tx);
  });
}

/**
 * Migração idempotente: na primeira leitura, se houver Settings.fixedMonthlyCost > 0
 * e nenhum FixedCostItem cadastrado, materializa o valor legado como item OUTROS/MENSAL.
 * Roda uma única vez (sem itens ela cria; depois de existir 1 item, nunca mais).
 */
export async function ensureLegacyFixedCostMigrated() {
  const count = await prisma.fixedCostItem.count();
  if (count > 0) return { migrated: false };

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const legacy = settings?.fixedMonthlyCost?.toString() ?? "0";
  if (Number(legacy) <= 0) return { migrated: false };

  await prisma.fixedCostItem.create({
    data: {
      name: "Custo fixo legado (migrar)",
      category: FixedCostCategory.OUTROS,
      frequency: FixedCostFrequency.MENSAL,
      amount: legacy,
      notes:
        "Item criado automaticamente a partir do antigo campo Settings.fixedMonthlyCost. " +
        "Edite o nome/valor ou substitua por itens detalhados.",
      active: true,
    },
  });
  return { migrated: true };
}

export type SummaryByCategory = Array<{
  category: FixedCostCategory;
  monthlyTotal: number;
  itemCount: number;
}>;

export async function getSummaryByCategory(): Promise<SummaryByCategory> {
  const items = await prisma.fixedCostItem.findMany({
    where: { active: true },
    select: { category: true, amount: true, frequency: true, active: true },
  });
  const groups = new Map<FixedCostCategory, { total: number; count: number }>();
  for (const it of items) {
    const monthly = it.frequency === "ANUAL"
      ? Number(it.amount) / 12
      : Number(it.amount);
    const cur = groups.get(it.category) ?? { total: 0, count: 0 };
    groups.set(it.category, { total: cur.total + monthly, count: cur.count + 1 });
  }
  return Array.from(groups.entries()).map(([category, g]) => ({
    category,
    monthlyTotal: g.total,
    itemCount: g.count,
  }));
}
