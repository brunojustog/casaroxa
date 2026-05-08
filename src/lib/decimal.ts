import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

/**
 * Helpers para lidar com valores monetários e quantidades sem float.
 * Sempre que tocar valores vindos do Prisma, normalize via toDecimal()
 * antes de fazer aritmética.
 */

export type DecimalLike = Decimal | Prisma.Decimal | number | string | null | undefined;

export function toDecimal(value: DecimalLike): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  if (value instanceof Decimal) return value;
  if (typeof value === "number" || typeof value === "string") return new Decimal(value);
  // Prisma.Decimal expõe toString seguro
  return new Decimal(value.toString());
}

export function toNumber(value: DecimalLike): number {
  return toDecimal(value).toNumber();
}

export function sumDecimal(values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Decimal(0));
}

export function isZero(value: DecimalLike): boolean {
  return toDecimal(value).isZero();
}

export function isPositive(value: DecimalLike): boolean {
  return toDecimal(value).gt(0);
}

/** Arredonda para 2 casas (centavos). */
export function roundMoney(value: DecimalLike): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Arredonda para 4 casas (custo unitário/quantidade). */
export function roundUnit(value: DecimalLike): Decimal {
  return toDecimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}
