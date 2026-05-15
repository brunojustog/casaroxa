import { z } from "zod";
import { IngredientCategory, IngredientUnit } from "@prisma/client";

const optionalString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

const positiveNumber = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return n;
  })
  .pipe(z.number().min(0));

const positiveQuantity = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return n;
  })
  .pipe(z.number().positive());

const optionalDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

const dateField = z
  .union([z.string(), z.date()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  })
  .pipe(z.date());

const itemDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("use_existing"),
    ingredientId: z.string().min(1),
    quantity: positiveQuantity,
    unitCost: positiveNumber,
    lotNumber: optionalString(60),
    expiryDate: optionalDate,
    updateIngredientCost: z.coerce.boolean().default(true),
    /** xProd original — usado pra salvar IngredientAlias automático. */
    rawName: z.string().trim().max(300).nullable().optional(),
  }),
  z.object({
    action: z.literal("create_new"),
    newName: z.string().trim().min(1).max(120),
    newCategory: z.nativeEnum(IngredientCategory),
    newUnit: z.nativeEnum(IngredientUnit),
    quantity: positiveQuantity,
    unitCost: positiveNumber,
    lotNumber: optionalString(60),
    expiryDate: optionalDate,
  }),
  z.object({
    action: z.literal("skip"),
  }),
]);

const supplierDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("use_existing"),
    supplierId: z.string().min(1),
  }),
  z.object({
    action: z.literal("create_new"),
    name: z.string().trim().min(1).max(120),
    cnpj: optionalString(20),
  }),
  z.object({ action: z.literal("none") }),
]);

export const importNfePayloadSchema = z.object({
  invoiceNumber: optionalString(60),
  invoiceDate: dateField,
  totalAmount: positiveNumber,
  notes: optionalString(2000),
  status: z.enum(["RASCUNHO", "CONFIRMADA"]),
  supplier: supplierDecisionSchema,
  items: z.array(itemDecisionSchema),
});

export type ImportNfePayloadInput = z.input<typeof importNfePayloadSchema>;
export type ImportNfePayloadData = z.output<typeof importNfePayloadSchema>;
