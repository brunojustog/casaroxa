import { z } from "zod";
import { SalesEventStatus, SalesEventWindowKind } from "@prisma/client";

const optionalString = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const requiredDate = () =>
  z
    .union([z.string(), z.date()])
    .transform((v) => {
      const d = v instanceof Date ? v : new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    })
    .refine((d): d is Date => d !== null, { message: "Data inválida" });

export const salesEventProductSchema = z
  .object({
    productId: z.string().optional().nullable(),
    comboId: z.string().optional().nullable(),
    quantityLimit: z
      .number()
      .int()
      .min(1, "Mínimo 1 unidade")
      .max(10000, "Máximo 10.000"),
    unitPriceCents: z.number().int().min(0).optional().nullable(),
    displayOrder: z.number().int().min(0).default(0),
  })
  .refine((v) => Boolean(v.productId) !== Boolean(v.comboId), {
    message: "Informe productId OU comboId (não os dois).",
  });

export const salesEventWindowSchema = z.object({
  kind: z.nativeEnum(SalesEventWindowKind),
  label: z.string().trim().min(1, "Rótulo é obrigatório").max(120),
  startsAt: requiredDate(),
  endsAt: requiredDate(),
  capacity: z.number().int().min(0).default(0),
  displayOrder: z.number().int().min(0).default(0),
});

export const salesEventFormSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(120),
    eventDate: requiredDate(),
    description: optionalString(1000),
    opensAt: requiredDate(),
    closesAt: requiredDate(),
    reservationTimeoutMinutes: z
      .number()
      .int()
      .min(15, "Mínimo 15 minutos")
      .max(1440, "Máximo 24h")
      .default(120),
    products: z.array(salesEventProductSchema).min(1, "Adicione pelo menos 1 produto"),
    windows: z.array(salesEventWindowSchema).min(1, "Adicione pelo menos 1 janela"),
    status: z.nativeEnum(SalesEventStatus).default("DRAFT"),
  })
  .superRefine((v, ctx) => {
    if (v.opensAt >= v.closesAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closesAt"],
        message: "Encerramento precisa ser depois da abertura",
      });
    }
    if (v.closesAt > v.eventDate) {
      // Pode até ser permitido em alguns casos; warning apenas se data muito futura
    }
    v.windows.forEach((w, i) => {
      if (w.endsAt <= w.startsAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["windows", i, "endsAt"],
          message: "Fim deve ser depois do início",
        });
      }
    });
  });

export type SalesEventFormInput = z.input<typeof salesEventFormSchema>;
export type SalesEventFormData = z.output<typeof salesEventFormSchema>;

export const salesEventListFiltersSchema = z.object({
  status: z
    .enum(["all", "DRAFT", "OPEN", "CLOSED", "CANCELLED"])
    .optional()
    .default("all"),
});
export type SalesEventListFilters = z.infer<typeof salesEventListFiltersSchema>;
