import { z } from "zod";
import { IngredientCategory, IngredientUnit } from "@prisma/client";

const optionalString = (max = 200) =>
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

export const ingredientFormSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  category: z.nativeEnum(IngredientCategory, {
    errorMap: () => ({ message: "Categoria inválida" }),
  }),
  unit: z.nativeEnum(IngredientUnit, {
    errorMap: () => ({ message: "Unidade inválida" }),
  }),
  unitCost: z
    .union([z.string(), z.number()])
    .transform((v) => {
      const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      return n;
    })
    .pipe(z.number({ invalid_type_error: "Custo inválido" }).min(0, "Custo não pode ser negativo")),
  packageSize: optionalPositive,
  packagePrice: optionalPositive,
  /** Estoque mínimo desejado (mesma unidade do ingrediente). Vazio = sem alerta. */
  minStock: optionalPositive,
  supplier: optionalString(120),
  brand: optionalString(120),
  notes: optionalString(2000),
  active: z.coerce.boolean().default(true),
});

export type IngredientFormInput = z.input<typeof ingredientFormSchema>;
export type IngredientFormData = z.output<typeof ingredientFormSchema>;

export const ingredientListFiltersSchema = z.object({
  search: z.string().trim().optional(),
  category: z.nativeEnum(IngredientCategory).optional(),
  active: z.enum(["all", "active", "inactive"]).optional().default("active"),
});

export type IngredientListFilters = z.infer<typeof ingredientListFiltersSchema>;
