import { z } from "zod";
import { SimulationTarget } from "@prisma/client";

const positiveNumber = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return n;
  })
  .pipe(z.number().min(0));

const optionalPercent = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n / 100;
  });

const optionalString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

export const saveSimulationSchema = z.object({
  targetType: z.nativeEnum(SimulationTarget),
  productId: z.string().optional().nullable(),
  comboId: z.string().optional().nullable(),
  currentCost: positiveNumber,
  currentPrice: positiveNumber.nullable().optional(),
  targetCmv: z
    .union([z.string(), z.number()])
    .transform((v) => {
      const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      return Number.isFinite(n) ? n / 100 : 0;
    })
    .pipe(z.number().min(0).max(1)),
  suggestedPrice: positiveNumber,
  simulatedPrice: positiveNumber,
  simulatedCmv: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? Number(v) : v))
    .pipe(z.number()),
  simulatedGrossProfit: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? Number(v) : v))
    .pipe(z.number()),
  cardFeePercent: optionalPercent,
  appFeePercent: optionalPercent,
  discountPercent: optionalPercent,
  notes: optionalString(500),
});
export type SaveSimulationData = z.output<typeof saveSimulationSchema>;

export const applyPriceSchema = z.object({
  targetType: z.nativeEnum(SimulationTarget),
  id: z.string().min(1),
  newPrice: positiveNumber,
});
export type ApplyPriceData = z.output<typeof applyPriceSchema>;
