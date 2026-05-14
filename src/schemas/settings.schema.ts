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

const optionalString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalPositive = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return Number.isFinite(n) && n >= 0 ? n : null;
  });

export const settingsFormSchema = z.object({
  businessName: z.string().trim().min(1, "Nome do negócio obrigatório").max(120),
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

  // Cardápio online
  siteSlogan: optionalString(200),
  whatsappNumber: optionalString(40),
  address: optionalString(300),
  addressNeighborhood: optionalString(200),
  openingHours: optionalString(200),
  instagramUrl: optionalString(300),
  facebookUrl: optionalString(300),
  pickupEnabled: z.coerce.boolean().default(true),
  deliveryEnabled: z.coerce.boolean().default(true),
  deliveryFeeNote: optionalString(300),
  minimumOrderValue: optionalPositive,
  // Promoção em destaque (hero da landing)
  heroPromoTitle: optionalString(120),
  heroPromoText: optionalString(500),
  heroPromoImageUrl: optionalString(500),
  heroPromoLinkLabel: optionalString(60),
  heroPromoLinkHref: optionalString(300),

  // WhatsApp API (wuzapi)
  whatsappApiEnabled: z.coerce.boolean().default(false),
  whatsappNotifyConfirmed: z.coerce.boolean().default(false),
  whatsappNotifyReady: z.coerce.boolean().default(false),
  whatsappNotifyOnDelivery: z.coerce.boolean().default(false),
  whatsappNotifyBirthday: z.coerce.boolean().default(false),
  whatsappNotifyLoyaltyRedeem: z.coerce.boolean().default(false),
  whatsappNotifyPaymentReceived: z.coerce.boolean().default(false),
  whatsappNotifyOrderRequestReceived: z.coerce.boolean().default(false),
  whatsappNotifyOrderRequestApproved: z.coerce.boolean().default(false),
  whatsappNotifyOrderRequestRejected: z.coerce.boolean().default(false),
  whatsappNotifyOrderRequestReady: z.coerce.boolean().default(false),
  whatsappNotifyNpsRequest: z.coerce.boolean().default(false),

  // Pagamento online (Asaas)
  asaasEnabled: z.coerce.boolean().default(false),
  asaasPaymentTtlHours: z.coerce.number().int().min(1).max(168).default(24),
});

export type SettingsFormInput = z.input<typeof settingsFormSchema>;
export type SettingsFormData = z.output<typeof settingsFormSchema>;
