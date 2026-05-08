import Decimal from "decimal.js";
import { FixedCostFrequency } from "@prisma/client";
import { sumDecimal, toDecimal, type DecimalLike } from "@/lib/decimal";

const MONTHS_IN_YEAR = new Decimal(12);

export function monthlyEquivalent(
  amount: DecimalLike,
  frequency: FixedCostFrequency,
): Decimal {
  const a = toDecimal(amount);
  return frequency === "ANUAL" ? a.div(MONTHS_IN_YEAR) : a;
}

export type FixedCostItemLike = {
  amount: DecimalLike;
  frequency: FixedCostFrequency;
  active: boolean;
};

export function sumActiveMonthly(items: FixedCostItemLike[]): Decimal {
  return sumDecimal(
    items.filter((i) => i.active).map((i) => monthlyEquivalent(i.amount, i.frequency)),
  );
}
