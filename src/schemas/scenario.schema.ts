import { z } from "zod";

const optionalString = (max = 2000) =>
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
  .pipe(z.number().min(0));

const positiveInt = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? parseInt(v, 10) : Math.floor(v);
    return n;
  })
  .pipe(z.number().int().min(0));

const percent = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return n;
  })
  .pipe(z.number().min(0).max(100))
  .transform((v) => v / 100);

export const scenarioFormSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  ordersPerWeekend: positiveInt,
  averageTicket: positiveNumber,
  weekendsPerMonth: positiveInt.refine((v) => v >= 1 && v <= 10, "Entre 1 e 10"),
  estimatedCmvPercent: percent,
  notes: optionalString(2000),
});

export type ScenarioFormInput = z.input<typeof scenarioFormSchema>;
export type ScenarioFormData = z.output<typeof scenarioFormSchema>;
