import { z } from "zod";
import { PaymentMethod, SaleProgress, SaleSource, SaleStatus } from "@prisma/client";

const optionalString = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const decimalString = (min = 0) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v))
    .pipe(z.number().min(min));

const positivePrice = decimalString(0);
const positiveQty = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v))
  .pipe(z.number().gt(0, "Quantidade deve ser maior que zero"));

const optionalDate = z
  .union([z.string(), z.date(), z.null()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    return v instanceof Date ? v : new Date(v);
  });

// ---------- Cabeçalho da venda ----------

export const saleHeaderFormSchema = z.object({
  occurredAt: optionalDate,
  source: z.nativeEnum(SaleSource).default(SaleSource.LOJA),
  customerName: optionalString(120),
  notes: optionalString(2000),
});
export type SaleHeaderFormData = z.output<typeof saleHeaderFormSchema>;

// ---------- Item da venda ----------

export const saleItemFormSchema = z
  .object({
    productId: z.string().trim().nullish().transform((v) => (v && v.length > 0 ? v : null)),
    comboId: z.string().trim().nullish().transform((v) => (v && v.length > 0 ? v : null)),
    quantity: positiveQty,
    /// Preço unitário override (se vazio, usa o salePrice atual do produto/combo).
    unitPrice: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((v) => {
        if (v === undefined || v === "") return undefined;
        return typeof v === "string" ? Number(v.replace(",", ".")) : v;
      })
      .pipe(z.number().min(0).optional()),
    notes: optionalString(500),
  })
  .refine(
    (v) => Boolean(v.productId) !== Boolean(v.comboId),
    { message: "Informe um produto OU um combo (não ambos)." },
  );
export type SaleItemFormInput = z.input<typeof saleItemFormSchema>;
export type SaleItemFormData = z.output<typeof saleItemFormSchema>;

/** Update inline de um item já existente: muda qty e/ou preço unitário. */
export const saleItemUpdateSchema = z.object({
  quantity: positiveQty,
  unitPrice: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v))
    .pipe(z.number().min(0, "Preço não pode ser negativo")),
});
export type SaleItemUpdateInput = z.input<typeof saleItemUpdateSchema>;
export type SaleItemUpdateData = z.output<typeof saleItemUpdateSchema>;

// ---------- Pagamento ----------

export const salePaymentFormSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  amount: positivePrice,
  /// Taxa em % (0-100). Se omitida, o service aplica o default das Settings.
  feePercent: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => {
      if (v === undefined || v === "") return undefined;
      const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      return n;
    })
    .pipe(z.number().min(0).max(100).optional())
    .transform((v) => (v === undefined ? undefined : v / 100)),
  notes: optionalString(500),
});
export type SalePaymentFormInput = z.input<typeof salePaymentFormSchema>;
export type SalePaymentFormData = z.output<typeof salePaymentFormSchema>;

// ---------- Filtros da lista ----------

export const saleListFiltersSchema = z.object({
  status: z
    .union([z.nativeEnum(SaleStatus), z.literal("all")])
    .optional()
    .default("all"),
  source: z
    .union([z.nativeEnum(SaleSource), z.literal("all")])
    .optional()
    .default("all"),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().trim().optional(),
});
export type SaleListFilters = z.infer<typeof saleListFiltersSchema>;

/** Update do progress do pedido (admin). */
export const saleProgressUpdateSchema = z.object({
  progress: z.nativeEnum(SaleProgress),
  estimateMinutes: z
    .union([z.string(), z.number(), z.null()])
    .nullish()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "string" ? parseInt(v, 10) : Math.floor(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }),
});
export type SaleProgressUpdateInput = z.input<typeof saleProgressUpdateSchema>;
export type SaleProgressUpdateData = z.output<typeof saleProgressUpdateSchema>;
