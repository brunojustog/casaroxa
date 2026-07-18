import { z } from "zod";

/** Form de viagem de compra do empório (admin). */
export const supplyTripFormSchema = z
  .object({
    tripDate: z.coerce.date({ errorMap: () => ({ message: "Data da viagem inválida" }) }),
    cutoffAt: z.coerce.date({ errorMap: () => ({ message: "Data limite inválida" }) }),
    notes: z
      .preprocess(
        (v) => {
          if (v == null) return null;
          const t = String(v).trim();
          return t.length > 0 ? t : null;
        },
        z.string().max(500).nullable(),
      ),
  })
  .superRefine((data, ctx) => {
    if (data.cutoffAt >= data.tripDate) {
      ctx.addIssue({
        path: ["cutoffAt"],
        code: z.ZodIssueCode.custom,
        message: "O limite de pedidos precisa ser antes da data da viagem.",
      });
    }
  });

export type SupplyTripFormData = z.output<typeof supplyTripFormSchema>;
