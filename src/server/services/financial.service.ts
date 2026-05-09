/**
 * Service financeiro / DRE.
 *
 * Consolida receita (vendas), CMV (custo direto via SaleItem.totalCost) e
 * custo fixo (Settings.fixedMonthlyCost — cache derivado dos FixedCostItem).
 *
 * O custo fixo entra **pro-rata pelo período**: monthlyFixed × (dias / 30).
 * Aproximação suficiente — Bruno valida com mês fechado quando o range
 * coincidir com o mês civil.
 */
import { SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sumDecimal, toDecimal } from "@/lib/decimal";

export type DrePeriod = {
  from: Date;
  to: Date;
  days: number;
  revenue: number;
  fees: number;
  netRevenue: number;
  /** Desconto manual no fechamento (cortesia). */
  discount: number;
  /** Desconto vindo de cupom aplicado no checkout público. */
  couponDiscount: number;
  cogs: number;
  grossMargin: number;
  grossMarginPct: number;
  fixedCosts: number;
  operatingResult: number;
  operatingResultPct: number;
  salesCount: number;
  avgTicket: number;
  cmvPct: number;
};

export type DreMonth = {
  month: string; // YYYY-MM
  monthLabel: string; // "mai/26"
  from: Date;
  to: Date;
} & Omit<DrePeriod, "from" | "to">;

const MONTH_PT_BR = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "2-digit",
}).format;

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfMonth(d: Date): Date {
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

async function getMonthlyFixedCostCache(): Promise<number> {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { fixedMonthlyCost: true },
  });
  return settings ? Number(settings.fixedMonthlyCost) : 0;
}

async function aggregateSalesInRange(from: Date, to: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      status: SaleStatus.CONCLUIDA,
      occurredAt: { gte: from, lte: to },
    },
    select: {
      totalRevenue: true,
      totalCost: true,
      totalFees: true,
      totalNet: true,
      totalDiscount: true,
      couponDiscount: true,
    },
  });

  const revenue = sumDecimal(sales.map((s) => s.totalRevenue));
  const cost = sumDecimal(sales.map((s) => s.totalCost));
  const fees = sumDecimal(sales.map((s) => s.totalFees));
  const netRevenue = sumDecimal(sales.map((s) => s.totalNet));
  const discount = sumDecimal(sales.map((s) => s.totalDiscount));
  const couponDiscount = sumDecimal(sales.map((s) => s.couponDiscount));

  return {
    salesCount: sales.length,
    revenue: Number(revenue),
    cogs: Number(cost),
    fees: Number(fees),
    netRevenue: Number(netRevenue),
    discount: Number(discount),
    couponDiscount: Number(couponDiscount),
  };
}

function buildDre(
  from: Date,
  to: Date,
  agg: Awaited<ReturnType<typeof aggregateSalesInRange>>,
  monthlyFixed: number,
): DrePeriod {
  const days = daysBetween(from, to);
  const fixedCosts = toDecimal(monthlyFixed).mul(days).div(30).toNumber();
  const grossMargin = agg.netRevenue - agg.cogs;
  const operatingResult = grossMargin - fixedCosts;
  const grossMarginPct =
    agg.netRevenue > 0 ? grossMargin / agg.netRevenue : 0;
  const operatingResultPct =
    agg.netRevenue > 0 ? operatingResult / agg.netRevenue : 0;
  const cmvPct = agg.revenue > 0 ? agg.cogs / agg.revenue : 0;
  const avgTicket = agg.salesCount > 0 ? agg.revenue / agg.salesCount : 0;

  return {
    from,
    to,
    days,
    revenue: agg.revenue,
    fees: agg.fees,
    netRevenue: agg.netRevenue,
    discount: agg.discount,
    couponDiscount: agg.couponDiscount,
    cogs: agg.cogs,
    grossMargin,
    grossMarginPct,
    fixedCosts,
    operatingResult,
    operatingResultPct,
    salesCount: agg.salesCount,
    avgTicket,
    cmvPct,
  };
}

// ---------- Public API ----------

export async function getDreForPeriod(
  rawFrom: Date,
  rawTo: Date,
): Promise<DrePeriod> {
  const from = startOfDay(rawFrom);
  const to = endOfDay(rawTo);
  const [agg, monthlyFixed] = await Promise.all([
    aggregateSalesInRange(from, to),
    getMonthlyFixedCostCache(),
  ]);
  return buildDre(from, to, agg, monthlyFixed);
}

/**
 * DRE consolidado dos últimos N meses (incluindo o mês corrente).
 * Útil para visualização de tendência mês-a-mês.
 */
export async function getDreLastMonths(n: number = 6): Promise<DreMonth[]> {
  const today = new Date();
  const monthlyFixed = await getMonthlyFixedCostCache();

  const months: DreMonth[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const from = startOfMonth(ref);
    const to = endOfMonth(ref);
    const agg = await aggregateSalesInRange(from, to);
    const dre = buildDre(from, to, agg, monthlyFixed);
    const ym = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      ...dre,
      from,
      to,
      month: ym,
      monthLabel: MONTH_PT_BR(ref),
    });
  }
  return months;
}

/** Resultado do mês corrente (para KPI no dashboard). */
export async function getCurrentMonthResult(): Promise<DrePeriod> {
  const now = new Date();
  return getDreForPeriod(startOfMonth(now), endOfMonth(now));
}

// ---------- Helpers de range pra page ----------

export function defaultPeriod(): { from: Date; to: Date } {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

export function parsePeriodFromParams(
  params: { from?: string; to?: string },
): { from: Date; to: Date } {
  const def = defaultPeriod();
  const from = params.from ? startOfDay(new Date(params.from)) : def.from;
  const to = params.to ? endOfDay(new Date(params.to)) : def.to;
  return { from, to };
}
