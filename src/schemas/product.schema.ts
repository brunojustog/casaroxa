import { z } from "zod";
import { ProductCategory, ProductStatus, ProductType } from "@prisma/client";

// Todos os "opcionais" aceitam null ALÉM de undefined (.nullish) — o form
// pode mandar null em campo limpo e o zod não pode explodir com
// "Expected string, received null".
const optionalString = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalPositive = z
  .union([z.string(), z.number()])
  .nullish()
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
  .nullish()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n / 100;
  });

/** Aceita string multilinha (1 URL por linha) ou array. Retorna string[] (vazio = null no banco). */
const galleryField = z
  .union([z.string(), z.array(z.string())])
  .nullish()
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
  /** Código do item na balança Toledo — exatamente 6 dígitos, ou vazio. */
  scaleCode: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || /^\d{6}$/.test(v), {
      message: "Código da balança deve ter exatamente 6 dígitos",
    }),
  /** Código de barras de fábrica (EAN-8/13) — só dígitos, ou vazio. */
  barcode: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.replace(/\D/g, "") : ""))
    .transform((v) => (v.length > 0 ? v : null))
    .refine((v) => v === null || (v.length >= 8 && v.length <= 14), {
      message: "Código de barras deve ter de 8 a 14 dígitos",
    }),
  /** Nome curto pra etiqueta da balança. A balança CENTRALIZA o texto no
   *  campo de 25 posições e imprime 20 — nome de até 16 chars sai sempre
   *  inteiro (17+ perde o final). Vazio = usa o nome normal. */
  scaleName: z
    .string()
    .trim()
    .max(16, "Nome na etiqueta: máximo 16 caracteres")
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
  /** NCM (8 dígitos) — classificação fiscal do produto na NFC-e. Vazio = default das Settings. */
  ncm: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.replace(/\D/g, "") : ""))
    .transform((v) => (v.length > 0 ? v : null))
    .refine((v) => v === null || /^\d{8}$/.test(v), {
      message: "NCM deve ter exatamente 8 dígitos",
    }),
  /** CEST (7 dígitos) — só produtos com substituição tributária. */
  cest: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.replace(/\D/g, "") : ""))
    .transform((v) => (v.length > 0 ? v : null))
    .refine((v) => v === null || /^\d{7}$/.test(v), {
      message: "CEST deve ter exatamente 7 dígitos",
    }),
  /** CFOP específico (4 dígitos). Vazio = default das Settings (5102). */
  cfop: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.replace(/\D/g, "") : ""))
    .transform((v) => (v.length > 0 ? v : null))
    .refine((v) => v === null || /^\d{4}$/.test(v), {
      message: "CFOP deve ter exatamente 4 dígitos",
    }),
  /** Validade impressa na etiqueta da balança (dias, 0–999). Vazio = não imprime. */
  scaleValidityDays: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return null;
      const n = typeof v === "string" ? Number(v) : v;
      return Number.isInteger(n) && n >= 0 && n <= 999 ? n : null;
    }),
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
