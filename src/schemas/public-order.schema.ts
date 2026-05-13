import { z } from "zod";

const requiredString = (field: string, max = 200) =>
  z.string().trim().min(1, `${field} é obrigatório`).max(max);

const optionalString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const publicOrderItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["PRODUTO", "COMBO"]),
  quantity: z.number().int().min(1).max(50),
});

export const publicOrderSchema = z
  .object({
    customerName: requiredString("Nome", 120),
    customerPhone: requiredString("Telefone", 40),
    deliveryMode: z.enum(["PICKUP", "DELIVERY"]),
    address: optionalString(300),
    addressNumber: optionalString(40),
    addressComplement: optionalString(120),
    neighborhood: optionalString(120),
    reference: optionalString(200),
    paymentHint: optionalString(60),
    notes: optionalString(500),
    /** Código de cupom (opcional). Validado server-side em public-order.service. */
    couponCode: optionalString(40),
    items: z.array(publicOrderItemSchema).min(1, "Carrinho vazio"),
    /** Pré-venda: se carrinho for de evento, ID do evento + janela escolhida. */
    salesEventId: z.string().min(1).optional().nullable(),
    salesEventWindowId: z.string().min(1).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMode === "DELIVERY") {
      if (!data.address) {
        ctx.addIssue({
          path: ["address"],
          code: z.ZodIssueCode.custom,
          message: "Endereço é obrigatório para delivery",
        });
      }
      if (!data.neighborhood) {
        ctx.addIssue({
          path: ["neighborhood"],
          code: z.ZodIssueCode.custom,
          message: "Bairro é obrigatório para delivery",
        });
      }
    }
  });

export type PublicOrderInput = z.input<typeof publicOrderSchema>;
export type PublicOrderData = z.output<typeof publicOrderSchema>;
