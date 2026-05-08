/**
 * Funções puras de cálculo. Não importam Prisma e não fazem I/O —
 * tudo aqui é trivialmente testável.
 */
import Decimal from "decimal.js";
import { isPositive, isZero, roundMoney, sumDecimal, toDecimal, type DecimalLike } from "@/lib/decimal";

// ---------- CMV / lucro ----------

export function calculateCmv(totalCost: DecimalLike, salePrice: DecimalLike): Decimal {
  if (!isPositive(salePrice)) return new Decimal(0);
  return toDecimal(totalCost).div(toDecimal(salePrice));
}

export function calculateGrossProfit(totalCost: DecimalLike, salePrice: DecimalLike): Decimal {
  return roundMoney(toDecimal(salePrice).minus(toDecimal(totalCost)));
}

// ---------- Custo de ficha técnica ----------

export type RecipeItemLike = { quantity: DecimalLike; unitCostSnapshot: DecimalLike };

export function calculateRecipeTotal(items: RecipeItemLike[]): Decimal {
  return sumDecimal(items.map((it) => toDecimal(it.quantity).mul(toDecimal(it.unitCostSnapshot))));
}

// ---------- Custo de combo ----------

export type ComboItemLike = { quantity: DecimalLike; unitCostSnapshot: DecimalLike };

export function calculateComboTotal(items: ComboItemLike[]): Decimal {
  return sumDecimal(items.map((it) => toDecimal(it.quantity).mul(toDecimal(it.unitCostSnapshot))));
}

// ---------- Precificação ----------

/** Preço sugerido = custo / meta CMV. */
export function calculateSuggestedPrice(cost: DecimalLike, targetCmv: DecimalLike): Decimal {
  const target = toDecimal(targetCmv);
  if (isZero(target)) return new Decimal(0);
  return roundMoney(toDecimal(cost).div(target));
}

/** Aplica taxa percentual e desconto sobre o preço de venda. */
export function calculateNetRevenue(
  salePrice: DecimalLike,
  options: {
    cardFeePercent?: DecimalLike;
    appFeePercent?: DecimalLike;
    discountPercent?: DecimalLike;
  } = {},
): Decimal {
  const price = toDecimal(salePrice);
  const totalDeduction = toDecimal(options.cardFeePercent ?? 0)
    .plus(toDecimal(options.appFeePercent ?? 0))
    .plus(toDecimal(options.discountPercent ?? 0));
  return roundMoney(price.mul(new Decimal(1).minus(totalDeduction)));
}

/** CMV considerando dedução de taxas/desconto. */
export function calculateCmvWithFees(
  cost: DecimalLike,
  salePrice: DecimalLike,
  options: {
    cardFeePercent?: DecimalLike;
    appFeePercent?: DecimalLike;
    discountPercent?: DecimalLike;
  } = {},
): Decimal {
  const net = calculateNetRevenue(salePrice, options);
  if (!isPositive(net)) return new Decimal(0);
  return toDecimal(cost).div(net);
}

// ---------- Cenários de faturamento ----------

export type ScenarioInput = {
  ordersPerWeekend: number;
  averageTicket: DecimalLike;
  weekendsPerMonth: number;
  estimatedCmvPercent: DecimalLike;
  fixedMonthlyCost: DecimalLike;
  totalInvestment: DecimalLike;
};

export type ScenarioResult = {
  weekendRevenue: Decimal;
  monthlyRevenue: Decimal;
  estimatedCmv: Decimal;
  grossProfit: Decimal;
  estimatedResult: Decimal;
  paybackMonths: Decimal | null;
};

export function calculateScenario(input: ScenarioInput): ScenarioResult {
  const ticket = toDecimal(input.averageTicket);
  const cmvPct = toDecimal(input.estimatedCmvPercent);
  const fixedCost = toDecimal(input.fixedMonthlyCost);
  const investment = toDecimal(input.totalInvestment);

  const weekendRevenue = ticket.mul(input.ordersPerWeekend);
  const monthlyRevenue = weekendRevenue.mul(input.weekendsPerMonth);
  const estimatedCmv = monthlyRevenue.mul(cmvPct);
  const grossProfit = monthlyRevenue.minus(estimatedCmv);
  const estimatedResult = grossProfit.minus(fixedCost);
  const paybackMonths = estimatedResult.gt(0) ? investment.div(estimatedResult) : null;

  return {
    weekendRevenue: roundMoney(weekendRevenue),
    monthlyRevenue: roundMoney(monthlyRevenue),
    estimatedCmv: roundMoney(estimatedCmv),
    grossProfit: roundMoney(grossProfit),
    estimatedResult: roundMoney(estimatedResult),
    paybackMonths: paybackMonths ? paybackMonths.toDecimalPlaces(2) : null,
  };
}
