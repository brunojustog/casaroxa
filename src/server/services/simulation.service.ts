import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { setProductSalePrice } from "./product.service";
import { setComboSalePrice } from "./combo.service";
import type {
  ApplyPriceData,
  SaveSimulationData,
} from "@/schemas/simulation.schema";

export async function listSimulationTargets() {
  const [products, combos] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        category: true,
        portionLabel: true,
        totalCost: true,
        salePrice: true,
        targetCmv: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.combo.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        category: true,
        totalCost: true,
        salePrice: true,
        targetCmv: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);
  return { products, combos };
}

export async function listRecentSimulations(limit = 10) {
  return prisma.priceSimulation.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function saveSimulation(input: SaveSimulationData) {
  if (input.targetType === "PRODUTO" && !input.productId) {
    throw new BusinessError("Produto não informado.");
  }
  if (input.targetType === "COMBO" && !input.comboId) {
    throw new BusinessError("Combo não informado.");
  }

  return prisma.priceSimulation.create({
    data: {
      targetType: input.targetType,
      productId: input.productId ?? null,
      comboId: input.comboId ?? null,
      currentCost: input.currentCost,
      currentPrice: input.currentPrice ?? null,
      targetCmv: input.targetCmv,
      suggestedPrice: input.suggestedPrice,
      simulatedPrice: input.simulatedPrice,
      simulatedCmv: input.simulatedCmv,
      simulatedGrossProfit: input.simulatedGrossProfit,
      cardFeePercent: input.cardFeePercent ?? null,
      appFeePercent: input.appFeePercent ?? null,
      discountPercent: input.discountPercent ?? null,
      notes: input.notes,
    },
  });
}

export async function applyPriceToTarget(input: ApplyPriceData) {
  if (input.targetType === "PRODUTO") {
    return setProductSalePrice(input.id, input.newPrice);
  }
  return setComboSalePrice(input.id, input.newPrice);
}
