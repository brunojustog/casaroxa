import { z } from "zod";
import { CampaignAudienceKey } from "@prisma/client";

export const campaignFormSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    message: z.string().trim().min(10).max(2000),
    audienceKey: z.nativeEnum(CampaignAudienceKey),
    // Cupom opcional
    couponCode: z
      .string()
      .trim()
      .max(30)
      .optional()
      .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
    couponType: z.enum(["PERCENT", "FIXED"]).optional(),
    couponValue: z.coerce.number().positive().optional(),
    couponMaxUses: z.coerce.number().int().positive().nullable().optional(),
    couponValidDays: z.coerce.number().int().positive().max(365).default(30),
  })
  .superRefine((data, ctx) => {
    if (data.couponCode) {
      if (!data.couponType) {
        ctx.addIssue({
          path: ["couponType"],
          code: z.ZodIssueCode.custom,
          message: "Tipo do cupom é obrigatório se há código.",
        });
      }
      if (!data.couponValue) {
        ctx.addIssue({
          path: ["couponValue"],
          code: z.ZodIssueCode.custom,
          message: "Valor do cupom é obrigatório se há código.",
        });
      }
    }
  });

export type CampaignFormData = z.output<typeof campaignFormSchema>;
