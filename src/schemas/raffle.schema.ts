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

export const rafflePrizeSchema = z.object({
  position: z.number().int().min(1).max(99),
  description: z.string().trim().min(1, "Descrição é obrigatória").max(500),
});

export type RafflePrizeInput = z.infer<typeof rafflePrizeSchema>;

export const raffleFormSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(120),
    imageUrl: optionalString(500),
    opensAt: requiredDate(),
    closesAt: requiredDate(),
    drawAt: optionalDate(),
    /// Lista de prêmios. Mínimo 1.
    prizes: z
      .array(rafflePrizeSchema)
      .min(1, "Pelo menos 1 prêmio")
      .max(20, "Máximo 20 prêmios"),
    ticketPriceCents: z
      .number()
      .int()
      .min(0, "Valor não pode ser negativo")
      .max(100000, "Valor máximo R$ 1.000")
      .default(0),
    totalNumbers: z
      .number()
      .int()
      .min(1, "Mínimo 1 número")
      .max(10000, "Máximo 10.000 números")
      .default(100),
    maxTicketsPerCustomer: z
      .number()
      .int()
      .min(1)
      .nullable()
      .default(null),
    /// Exclusivo do app: só participa quem tem o PWA com push ativo.
    appOnly: z.boolean().default(false),
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
    const positions = new Set<number>();
    v.prizes.forEach((p, i) => {
      if (positions.has(p.position)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prizes", i, "position"],
          message: "Posições não podem se repetir",
        });
      }
      positions.add(p.position);
    });
    // Rifa paga com ticket < R$ 5: Asaas exige R$ 5 mínimo por cobrança.
    // Se admin define limite=1 e preço < R$ 5, cliente fica TRAVADO ao
    // tentar pagar 1 número (valor abaixo do mínimo do banco). Avisa.
    if (
      v.ticketPriceCents > 0 &&
      v.ticketPriceCents < 500 &&
      v.maxTicketsPerCustomer !== null
    ) {
      const minRequired = Math.ceil(500 / v.ticketPriceCents);
      if (v.maxTicketsPerCustomer < minRequired) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maxTicketsPerCustomer"],
          message: `Com ticket abaixo de R$ 5, o limite deve ser pelo menos ${minRequired} (Asaas exige R$ 5 mínimo por cobrança). Aumente o limite ou deixe vazio (sem limite).`,
        });
      }
    }
    // Rifa gratuita: limite por cliente é obrigatório pra evitar que um
    // só usuário pegue todos os números (e fure quem indicar amigo).
    if (v.ticketPriceCents === 0 && v.maxTicketsPerCustomer === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxTicketsPerCustomer"],
        message:
          "Em sorteio gratuito, é preciso definir limite de números por cliente.",
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
