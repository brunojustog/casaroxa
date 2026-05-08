import type { StockMovementType } from "@prisma/client";

export const STOCK_MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  PERDA: "Perda",
  AJUSTE: "Ajuste +",
};

/** Cores Tailwind para o badge de tipo de movimento. */
export const STOCK_MOVEMENT_TYPE_TONE: Record<
  StockMovementType,
  "success" | "info" | "danger" | "neutral"
> = {
  ENTRADA: "success",
  SAIDA: "info",
  PERDA: "danger",
  AJUSTE: "neutral",
};
