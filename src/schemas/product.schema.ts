import { z } from "zod";
import { ProductCategory, ProductStatus, ProductType } from "@prisma/client";

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

/**
 * Aceita 0–100 (percent) e converte para fração (0–1) que é o que vai no banco.
 * Vazio → null.
 */
const optionalPercent = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n / 100;
  });

/** Aceita string multilinha (1 URL por linha) ou array. Retorna string[] (vazio = null no banco). */
const galleryField = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (!v) return null;
    const arr =
      typeof v === "string"
        ? v
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : v.map((s) => s.trim()).filter((s) => s.length > 0);
    return arr.length > 0 ? arr : null;
  });

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  category: z.nativeEnum(ProductCategory, {
    errorMap: () => ({ message: "Categoria inválida" }),
  }),
  type: z.nativeEnum(ProductType, {
    errorMap: () => ({ message: "Tipo inválido" }),
  }),
  portionLabel: optionalString(60),
  salePrice: optionalPositive,
  targetCmv: optionalPercent,
  description: optionalString(500),
  notes: optionalString(2000),
  status: z.nativeEnum(ProductStatus, {
    errorMap: () => ({ message: "Status inválido" }),
  }),
  active: z.coerce.boolean().default(true),
  imageUrl: optionalString(500),
  showInMenu: z.coerce.boolean().default(false),
  ingredientsPublic: optionalString(1000),
  gallery: galleryField,
  youtubeUrl: optionalString(500),
});

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormData = z.output<typeof productFormSchema>;

export const productListFiltersSchema = z.object({
  search: z.string().trim().optional(),
  category: z.nativeEnum(ProductCategory).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  active: z.enum(["all", "active", "inactive"]).optional().default("active"),
});

export type ProductListFilters = z.infer<typeof productListFiltersSchema>;
