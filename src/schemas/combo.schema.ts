import { z } from "zod";
import { ProductCategory } from "@prisma/client";

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

const optionalPercent = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n / 100;
  });

const positiveNumber = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return n;
  })
  .pipe(z.number({ invalid_type_error: "Quantidade inválida" }).min(0, "Quantidade não pode ser negativa"));

export const comboItemInputSchema = z.object({
  productId: z.string().min(1, "Produto obrigatório"),
  quantity: positiveNumber,
});

export const saveComboSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  category: z.nativeEnum(ProductCategory, {
    errorMap: () => ({ message: "Categoria inválida" }),
  }),
  description: optionalString(500),
  salePrice: optionalPositive,
  targetCmv: optionalPercent,
  notes: optionalString(2000),
  active: z.coerce.boolean().default(true),
  imageUrl: optionalString(500),
  showInMenu: z.coerce.boolean().default(false),
  items: z.array(comboItemInputSchema),
});

export type SaveComboInput = z.input<typeof saveComboSchema>;
export type SaveComboData = z.output<typeof saveComboSchema>;

export const comboListFiltersSchema = z.object({
  search: z.string().trim().optional(),
  category: z.nativeEnum(ProductCategory).optional(),
  active: z.enum(["all", "active", "inactive"]).optional().default("active"),
});
export type ComboListFilters = z.infer<typeof comboListFiltersSchema>;
