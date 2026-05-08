import { z } from "zod";
import { PurchaseStatus } from "@prisma/client";

const optionalString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const positiveNumber = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return n;
  })
  .pipe(z.number({ invalid_type_error: "Valor inválido" }).min(0));

const positiveQuantity = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return n;
  })
  .pipe(
    z
      .number({ invalid_type_error: "Quantidade inválida" })
      .positive("Quantidade deve ser maior que zero"),
  );

const dateField = z
  .union([z.string(), z.date()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  })
  .pipe(z.date({ invalid_type_error: "Data inválida" }));

const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

const optionalCuid = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

export const purchaseItemInputSchema = z.object({
  ingredientId: z.string().min(1, "Ingrediente obrigatório"),
  quantity: positiveQuantity,
  unitCost: positiveNumber,
  lotNumber: optionalString(60),
  expiryDate: optionalDate,
  updateIngredientCost: z.coerce.boolean().default(true),
});

export type PurchaseItemInput = z.infer<typeof purchaseItemInputSchema>;

export const savePurchaseSchema = z.object({
  supplierId: optionalCuid,
  invoiceNumber: optionalString(60),
  invoiceDate: dateField,
  notes: optionalString(2000),
  items: z.array(purchaseItemInputSchema),
});

export type SavePurchaseInput = z.input<typeof savePurchaseSchema>;
export type SavePurchaseData = z.output<typeof savePurchaseSchema>;

export const purchaseListFiltersSchema = z.object({
  search: z.string().trim().optional(),
  supplierId: z.string().optional(),
  status: z.nativeEnum(PurchaseStatus).optional(),
});
export type PurchaseListFilters = z.infer<typeof purchaseListFiltersSchema>;
