import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import type { SettingsFormData } from "@/schemas/settings.schema";

export async function getSettings() {
  const s = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  return s;
}

export function getSettingsHistory(limit = 30) {
  return prisma.settingsHistory.findMany({
    where: { settingsId: 1 },
    orderBy: { changedAt: "desc" },
    take: limit,
    include: { changedBy: { select: { name: true } } },
  });
}

export async function updateSettings(input: SettingsFormData, userId: string) {
  const current = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!current) throw new BusinessError("Settings não encontrado.");

  // As faixas HH:mm de sáb/dom não são colunas — viram o JSON kitchenHours.
  const {
    kitchenSatOpen,
    kitchenSatClose,
    kitchenSunOpen,
    kitchenSunClose,
    ...rest
  } = input;
  const kitchenHours = buildKitchenHours({
    kitchenSatOpen,
    kitchenSatClose,
    kitchenSunOpen,
    kitchenSunClose,
  });

  return prisma.$transaction(async (tx) => {
    // Snapshot do estado anterior
    await tx.settingsHistory.create({
      data: {
        settingsId: 1,
        snapshot: serializeSettings(current) as unknown as Prisma.InputJsonValue,
        changedById: userId,
      },
    });

    return tx.settings.update({
      where: { id: 1 },
      data: { ...rest, kitchenHours: kitchenHours as Prisma.InputJsonValue },
    });
  });
}

/** Monta o JSON kitchenHours a partir das faixas de sáb/dom do formulário. */
function buildKitchenHours(v: {
  kitchenSatOpen: string;
  kitchenSatClose: string;
  kitchenSunOpen: string;
  kitchenSunClose: string;
}): Record<string, { open: string; close: string }> {
  const out: Record<string, { open: string; close: string }> = {};
  if (v.kitchenSatOpen && v.kitchenSatClose && v.kitchenSatOpen < v.kitchenSatClose) {
    out.SAB = { open: v.kitchenSatOpen, close: v.kitchenSatClose };
  }
  if (v.kitchenSunOpen && v.kitchenSunClose && v.kitchenSunOpen < v.kitchenSunClose) {
    out.DOM = { open: v.kitchenSunOpen, close: v.kitchenSunClose };
  }
  return out;
}

function serializeSettings(s: Awaited<ReturnType<typeof getSettings>>) {
  return {
    businessName: s.businessName,
    fixedMonthlyCost: Number(s.fixedMonthlyCost),
    investedAmount: Number(s.investedAmount),
    plannedInvestment: Number(s.plannedInvestment),
    targetAverageTicket: Number(s.targetAverageTicket),
    targetOrdersPerWeekend: s.targetOrdersPerWeekend,
    weekendsPerMonth: s.weekendsPerMonth,
    defaultCmvChicken: Number(s.defaultCmvChicken),
    defaultCmvBeefRib: Number(s.defaultCmvBeefRib),
    defaultCmvPork: Number(s.defaultCmvPork),
    defaultCmvSides: Number(s.defaultCmvSides),
    defaultCmvExtras: Number(s.defaultCmvExtras),
    defaultCmvBeverages: Number(s.defaultCmvBeverages),
    defaultCmvCombos: Number(s.defaultCmvCombos),
    cardFeePercent: Number(s.cardFeePercent),
    appFeePercent: Number(s.appFeePercent),
    beefRibLossPercent: Number(s.beefRibLossPercent),
    porkRibLossPercent: Number(s.porkRibLossPercent),
    pancetaLossPercent: Number(s.pancetaLossPercent),
    porkLoinLossPercent: Number(s.porkLoinLossPercent),
    siteSlogan: s.siteSlogan,
    whatsappNumber: s.whatsappNumber,
    address: s.address,
    addressNeighborhood: s.addressNeighborhood,
    openingHours: s.openingHours,
    instagramUrl: s.instagramUrl,
    facebookUrl: s.facebookUrl,
    emporioWhatsappGroupUrl: s.emporioWhatsappGroupUrl,
    pickupEnabled: s.pickupEnabled,
    deliveryEnabled: s.deliveryEnabled,
    deliveryFeeNote: s.deliveryFeeNote,
    minimumOrderValue:
      s.minimumOrderValue !== null ? Number(s.minimumOrderValue) : null,
    heroPromoTitle: s.heroPromoTitle,
    heroPromoText: s.heroPromoText,
    heroPromoImageUrl: s.heroPromoImageUrl,
    heroPromoLinkLabel: s.heroPromoLinkLabel,
    heroPromoLinkHref: s.heroPromoLinkHref,
    whatsappApiEnabled: s.whatsappApiEnabled,
    whatsappNotifyConfirmed: s.whatsappNotifyConfirmed,
    whatsappNotifyReady: s.whatsappNotifyReady,
    whatsappNotifyOnDelivery: s.whatsappNotifyOnDelivery,
    whatsappNotifyBirthday: s.whatsappNotifyBirthday,
    whatsappNotifyLoyaltyRedeem: s.whatsappNotifyLoyaltyRedeem,
    whatsappNotifyPaymentReceived: s.whatsappNotifyPaymentReceived,
    asaasEnabled: s.asaasEnabled,
    asaasPaymentTtlHours: s.asaasPaymentTtlHours,
    kitchenScheduleEnabled: s.kitchenScheduleEnabled,
    kitchenHours: s.kitchenHours ?? null,
  };
}
