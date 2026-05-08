import { z } from "zod";

const positive = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return n;
  })
  .pipe(z.number().min(0));

const positiveInt = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? parseInt(v, 10) : Math.floor(v);
    return n;
  })
  .pipe(z.number().int().min(0));

/** Aceita 0–100 (percent) → fração (0..1). */
const percentField = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return n;
  })
  .pipe(z.number().min(0).max(100))
  .transform((v) => v / 100);

export const settingsFormSchema = z.object({
  businessName: z.string().trim().min(1, "Nome do negócio obrigatório").max(120),
  fixedMonthlyCost: positive,
  investedAmount: positive,
  plannedInvestment: positive,
  targetAverageTicket: positive,
  targetOrdersPerWeekend: positiveInt,
  weekendsPerMonth: positiveInt,
  defaultCmvChicken: percentField,
  defaultCmvBeefRib: percentField,
  defaultCmvPork: percentField,
  defaultCmvSides: percentField,
  defaultCmvExtras: percentField,
  defaultCmvBeverages: percentField,
  defaultCmvCombos: percentField,
  cardFeePercent: percentField,
  appFeePercent: percentField,
  beefRibLossPercent: percentField,
  porkRibLossPercent: percentField,
  pancetaLossPercent: percentField,
  porkLoinLossPercent: percentField,
});

export type SettingsFormInput = z.input<typeof settingsFormSchema>;
export type SettingsFormData = z.output<typeof settingsFormSchema>;
