import { z } from "zod";

const optionalString = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const inventoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome pra contagem").max(120),
  notes: optionalString(2000),
  /**
   * Se true, popula a contagem com TODOS os ingredientes ativos
   * (saldo do sistema vira o expectedQuantity de cada um).
   * Se false, abre vazio e o operador adiciona à mão.
   */
  populateAllActive: z.coerce.boolean().default(true),
});

export type InventoryCreateInput = z.input<typeof inventoryCreateSchema>;
export type InventoryCreateData = z.output<typeof inventoryCreateSchema>;

export const inventoryItemCountSchema = z.object({
  countedQuantity: z.coerce
    .number()
    .nonnegative("Quantidade não pode ser negativa")
    .max(999_999),
  notes: optionalString(500),
});
export type InventoryItemCountData = z.output<typeof inventoryItemCountSchema>;

export const inventoryAddItemSchema = z.object({
  ingredientId: z.string().min(1),
});
export type InventoryAddItemData = z.output<typeof inventoryAddItemSchema>;

export const inventoryListFiltersSchema = z.object({
  status: z.enum(["all", "ABERTA", "FECHADA", "CANCELADA"]).optional().default("all"),
});
export type InventoryListFilters = z.infer<typeof inventoryListFiltersSchema>;
