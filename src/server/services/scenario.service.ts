import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";
import { calculateScenario } from "@/domain/calculations";
import { BusinessError } from "@/server/auth-helpers";
import type { ScenarioFormData } from "@/schemas/scenario.schema";

async function getCurrentSettings() {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!s) throw new BusinessError("Configurações não encontradas. Acesse /configuracoes.");
  return s;
}

export function listScenarios() {
  return prisma.scenario.findMany({ orderBy: { createdAt: "asc" } });
}

export function getScenarioById(id: string) {
  return prisma.scenario.findUnique({ where: { id } });
}

/**
 * Recalcula valores derivados a partir dos inputs e premissas atuais.
 * Os valores derivados ficam congelados no row do cenário (snapshot).
 */
async function buildScenarioDerived(input: ScenarioFormData) {
  const settings = await getCurrentSettings();
  const totalInvestment = toDecimal(settings.investedAmount).plus(
    toDecimal(settings.plannedInvestment),
  );

  const result = calculateScenario({
    ordersPerWeekend: input.ordersPerWeekend,
    averageTicket: input.averageTicket,
    weekendsPerMonth: input.weekendsPerMonth,
    estimatedCmvPercent: input.estimatedCmvPercent,
    fixedMonthlyCost: settings.fixedMonthlyCost,
    totalInvestment,
  });

  return { settings, result };
}

export async function createScenario(input: ScenarioFormData) {
  const { settings, result } = await buildScenarioDerived(input);

  return prisma.scenario.create({
    data: {
      name: input.name,
      ordersPerWeekend: input.ordersPerWeekend,
      averageTicket: input.averageTicket,
      weekendsPerMonth: input.weekendsPerMonth,
      estimatedCmvPercent: input.estimatedCmvPercent,
      monthlyRevenue: result.monthlyRevenue.toNumber(),
      grossProfit: result.grossProfit.toNumber(),
      fixedCost: settings.fixedMonthlyCost,
      estimatedResult: result.estimatedResult.toNumber(),
      paybackMonths: result.paybackMonths ? result.paybackMonths.toNumber() : null,
      notes: input.notes,
    },
  });
}

export async function updateScenario(id: string, input: ScenarioFormData) {
  const cur = await prisma.scenario.findUnique({ where: { id }, select: { id: true } });
  if (!cur) throw new BusinessError("Cenário não encontrado.");

  const { settings, result } = await buildScenarioDerived(input);

  return prisma.scenario.update({
    where: { id },
    data: {
      name: input.name,
      ordersPerWeekend: input.ordersPerWeekend,
      averageTicket: input.averageTicket,
      weekendsPerMonth: input.weekendsPerMonth,
      estimatedCmvPercent: input.estimatedCmvPercent,
      monthlyRevenue: result.monthlyRevenue.toNumber(),
      grossProfit: result.grossProfit.toNumber(),
      fixedCost: settings.fixedMonthlyCost,
      estimatedResult: result.estimatedResult.toNumber(),
      paybackMonths: result.paybackMonths ? result.paybackMonths.toNumber() : null,
      notes: input.notes,
    },
  });
}

export async function deleteScenario(id: string) {
  await prisma.scenario.delete({ where: { id } });
}

export async function duplicateScenario(id: string) {
  const orig = await prisma.scenario.findUnique({ where: { id } });
  if (!orig) throw new BusinessError("Cenário não encontrado.");
  let name = `${orig.name} (cópia)`;
  let suffix = 2;
  // não há unique em name, mas vamos manter para clareza
  while (
    await prisma.scenario.findFirst({ where: { name }, select: { id: true } })
  ) {
    name = `${orig.name} (cópia ${suffix++})`;
  }
  return prisma.scenario.create({
    data: { ...orig, id: undefined, name, createdAt: undefined, updatedAt: undefined },
  });
}
