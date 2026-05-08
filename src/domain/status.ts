import { isPositive, isZero, toDecimal, type DecimalLike } from "@/lib/decimal";

/**
 * Status computado de produtos e combos. NÃO é armazenado no banco —
 * sempre calculado a partir do estado atual.
 */
export type ItemStatus = "OK" | "SEM_CUSTO" | "SEM_PRECO" | "REVER";

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  OK: "OK",
  SEM_CUSTO: "Sem custo",
  SEM_PRECO: "Sem preço",
  REVER: "Rever preço/custo",
};

/** Classes Tailwind para cada status (badge). */
export const ITEM_STATUS_CLASS: Record<ItemStatus, string> = {
  OK: "bg-green-100 text-green-800 ring-green-200",
  SEM_CUSTO: "bg-red-100 text-red-800 ring-red-200",
  SEM_PRECO: "bg-yellow-100 text-yellow-800 ring-yellow-200",
  REVER: "bg-orange-100 text-orange-800 ring-orange-200",
};

export function getStatus(
  cost: DecimalLike,
  price: DecimalLike,
  targetCmv: DecimalLike,
): ItemStatus {
  if (isZero(cost)) return "SEM_CUSTO";
  if (!isPositive(price)) return "SEM_PRECO";
  const cmv = toDecimal(cost).div(toDecimal(price));
  if (toDecimal(targetCmv).gt(0) && cmv.gt(toDecimal(targetCmv))) return "REVER";
  return "OK";
}
