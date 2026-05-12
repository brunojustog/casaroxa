import { z } from "zod";
import { RaffleStatus } from "@prisma/client";

const optionalString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const requiredDate = () =>
  z
    .union([z.string(), z.date()])
    .transform((v) => {
      const d = v instanceof Date ? v : new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    })
    .refine((d): d is Date => d !== null, { message: "Data inválida" });

const optionalDate = () =>
  z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((v) => {
      if (!v) return null;
      const d = v instanceof Date ? v : new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    });

export const raffleFormSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(120),
    prizeDescription: optionalString(500),
    imageUrl: optionalString(500),
    opensAt: requiredDate(),
    closesAt: requiredDate(),
    drawAt: optionalDate(),
    /// Preço por ticket em centavos. 0 = rifa gratuita.
    ticketPriceCents: z
      .number()
      .int()
      .min(0, "Valor não pode ser negativo")
      .max(100000, "Valor máximo R$ 1.000")
      .default(0),
    status: z.nativeEnum(RaffleStatus).default("DRAFT"),
  })
  .superRefine((v, ctx) => {
    if (v.opensAt >= v.closesAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closesAt"],
        message: "Data de encerramento precisa ser depois da abertura",
      });
    }
    if (v.drawAt && v.drawAt < v.closesAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["drawAt"],
        message: "Data do sorteio precisa ser depois do encerramento",
      });
    }
  });

export type RaffleFormInput = z.input<typeof raffleFormSchema>;
export type RaffleFormData = z.output<typeof raffleFormSchema>;

export const raffleListFiltersSchema = z.object({
  status: z
    .enum(["all", "DRAFT", "OPEN", "CLOSED", "DRAWN", "CANCELLED"])
    .optional()
    .default("all"),
});
export type RaffleListFilters = z.infer<typeof raffleListFiltersSchema>;
