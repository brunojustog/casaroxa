import { z } from "zod";
import { StockMovementType } from "@prisma/client";

const optionalString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalPositive = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return Number.isFinite(n) && n >= 0 ? n : null;
  });

const positiveQuantity = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return n;
  })
  .pipe(z.number({ invalid_type_error: "Quantidade inválida" }).positive("Quantidade deve ser maior que zero"));

const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

export const stockMovementFormSchema = z.object({
  ingredientId: z.string().min(1, "Ingrediente obrigatório"),
  type: z.nativeEnum(StockMovementType, {
    errorMap: () => ({ message: "Tipo de movimento inválido" }),
  }),
  quantity: positiveQuantity,
  unitCost: optionalPositive,
  lotNumber: optionalString(60),
  expiryDate: optionalDate,
  notes: optionalString(500),
});

export type StockMovementFormInput = z.input<typeof stockMovementFormSchema>;
export type StockMovementFormData = z.output<typeof stockMovementFormSchema>;

export const stockListFiltersSchema = z.object({
  search: z.string().trim().optional(),
  type: z.nativeEnum(StockMovementType).optional(),
  ingredientId: z.string().optional(),
  /** "expiring" | "empty" | "below_min" | "all" — filtros derivados aplicados na UI/service. */
  filter: z.enum(["all", "expiring", "empty", "below_min"]).optional().default("all"),
});

export type StockListFilters = z.infer<typeof stockListFiltersSchema>;
