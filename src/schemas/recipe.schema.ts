import { z } from "zod";

const optionalString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const positiveNumber = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return n;
  })
  .pipe(z.number({ invalid_type_error: "Quantidade inválida" }).min(0, "Quantidade não pode ser negativa"));

export const recipeItemInputSchema = z.object({
  ingredientId: z.string().min(1, "Ingrediente obrigatório"),
  quantity: positiveNumber,
  notes: optionalString(500),
});

export type RecipeItemInput = z.infer<typeof recipeItemInputSchema>;

export const saveRecipeSchema = z.object({
  productId: z.string().min(1),
  responsible: optionalString(120),
  notes: optionalString(2000),
  items: z.array(recipeItemInputSchema),
});

export type SaveRecipeInput = z.input<typeof saveRecipeSchema>;
export type SaveRecipeData = z.output<typeof saveRecipeSchema>;

export const saveRecipeVersionSchema = z.object({
  notes: optionalString(500),
});

export const recipeListFiltersSchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["all", "no_recipe", "needs_review", "reviewed"]).optional().default("all"),
});
export type RecipeListFilters = z.infer<typeof recipeListFiltersSchema>;
