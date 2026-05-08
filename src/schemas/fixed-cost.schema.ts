import { z } from "zod";
import { FixedCostCategory, FixedCostFrequency } from "@prisma/client";

const optionalString = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const positiveAmount = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v))
  .pipe(z.number().min(0, "Valor deve ser maior ou igual a zero"));

export const fixedCostItemFormSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  category: z.nativeEnum(FixedCostCategory),
  frequency: z.nativeEnum(FixedCostFrequency).default(FixedCostFrequency.MENSAL),
  amount: positiveAmount,
  notes: optionalString(2000),
  active: z.coerce.boolean().default(true),
});

export type FixedCostItemFormInput = z.input<typeof fixedCostItemFormSchema>;
export type FixedCostItemFormData = z.output<typeof fixedCostItemFormSchema>;

export const fixedCostListFiltersSchema = z.object({
  search: z.string().trim().optional(),
  category: z
    .union([z.nativeEnum(FixedCostCategory), z.literal("all")])
    .optional()
    .default("all"),
  active: z.enum(["all", "active", "inactive"]).optional().default("active"),
});
export type FixedCostListFilters = z.infer<typeof fixedCostListFiltersSchema>;
