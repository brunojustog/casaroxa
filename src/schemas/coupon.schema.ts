import { z } from "zod";

export const COUPON_TYPES = ["PERCENT", "FIXED"] as const;

const optionalString = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalDate = () =>
  z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((v) => {
      if (!v) return null;
      const d = typeof v === "string" ? new Date(v) : v;
      return isNaN(d.getTime()) ? null : d;
    });

const optionalPositiveInt = () =>
  z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return null;
      const n = typeof v === "string" ? parseInt(v, 10) : v;
      return Number.isFinite(n) && n > 0 ? n : null;
    });

const optionalMoney = () =>
  z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return null;
      const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
      return Number.isFinite(n) && n >= 0 ? n : null;
    });

export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, "Código tem que ter ao menos 2 caracteres")
      .max(40, "Código longo demais")
      .regex(/^[A-Z0-9_-]+$/, "Use só letras, números, '-' e '_'"),
    description: optionalString(200),
    type: z.enum(COUPON_TYPES),
    value: z.coerce.number().positive("Valor precisa ser maior que zero"),
    maxUses: optionalPositiveInt(),
    minOrderAmount: optionalMoney(),
    validFrom: optionalDate(),
    validUntil: optionalDate(),
    active: z.coerce.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.type === "PERCENT" && v.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Percentual não pode passar de 100",
      });
    }
    if (v.validFrom && v.validUntil && v.validFrom > v.validUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validUntil"],
        message: "Data final precisa ser depois da inicial",
      });
    }
  });

export type CouponFormInput = z.input<typeof couponFormSchema>;
export type CouponFormData = z.output<typeof couponFormSchema>;

export const couponListFiltersSchema = z.object({
  search: z.string().trim().optional(),
  active: z.enum(["all", "active", "inactive"]).optional().default("active"),
});
export type CouponListFilters = z.infer<typeof couponListFiltersSchema>;

/** Schema mínimo pra validar um código vindo do checkout público. */
export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1)
  .max(40);
