import { z } from "zod";

const requiredString = (field: string, max = 200) =>
  z
    .preprocess(
      (v) => (v == null ? "" : v),
      z.string().trim().min(1, `${field} é obrigatório`).max(max),
    );

const optionalString = (max = 500) =>
  z.preprocess(
    (v) => {
      if (v == null) return null;
      const trimmed = String(v).trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().max(max).nullable(),
  );

export const orderRequestItemSchema = z.object({
  productId: z.string().min(1).optional().nullable(),
  comboId: z.string().min(1).optional().nullable(),
  quantity: z.number().int().min(1).max(200),
});

const baseSchema = z
  .object({
    customerName: requiredString("Nome", 120),
    customerPhone: requiredString("Telefone", 40),
    requestedFor: z.coerce.date(),
    /** SEMANAL = assados/congelados (data livre). EMPORIO = atrelada a viagem. */
    kind: z.enum(["SEMANAL", "EMPORIO"]).default("SEMANAL"),
    supplyTripId: optionalString(60),
    /** Retirada em ponto parceiro (força deliveryMode PICKUP no servidor). */
    pickupPointId: optionalString(60),
    deliveryMode: z.enum(["PICKUP", "DELIVERY"]),
    address: optionalString(300),
    addressNumber: optionalString(40),
    addressComplement: optionalString(120),
    neighborhood: optionalString(120),
    reference: optionalString(200),
    notes: optionalString(500),
    items: z.array(orderRequestItemSchema).min(1, "Adicione pelo menos um item."),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "EMPORIO" && !data.supplyTripId) {
      ctx.addIssue({
        path: ["supplyTripId"],
        code: z.ZodIssueCode.custom,
        message: "Escolha a viagem em que a encomenda será atendida.",
      });
    }
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
    for (const [i, item] of data.items.entries()) {
      const hasProduct = !!item.productId;
      const hasCombo = !!item.comboId;
      if (hasProduct === hasCombo) {
        ctx.addIssue({
          path: ["items", i],
          code: z.ZodIssueCode.custom,
          message: "Cada item precisa de produto OU combo (não os dois).",
        });
      }
    }
  });

/** Schema usado no fluxo público — exige antecedência mínima de N horas. */
export const publicOrderRequestSchema = baseSchema;

/** Schema usado pelo admin — admin pode criar pra qualquer data (sem leadTime). */
export const adminOrderRequestSchema = baseSchema;

export type PublicOrderRequestData = z.output<typeof publicOrderRequestSchema>;
export type AdminOrderRequestData = z.output<typeof adminOrderRequestSchema>;

export const approveOrderRequestSchema = z.object({
  depositRequiredCents: z
    .number()
    .int()
    .min(0)
    .max(1_000_000_00)
    .optional()
    .nullable(),
  adminNotes: optionalString(500),
});
export type ApproveOrderRequestData = z.output<typeof approveOrderRequestSchema>;

export const rejectOrderRequestSchema = z.object({
  rejectionReason: requiredString("Motivo da recusa", 500),
});
export type RejectOrderRequestData = z.output<typeof rejectOrderRequestSchema>;
