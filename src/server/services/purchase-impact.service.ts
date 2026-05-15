/**
 * Preview de impacto de uma Purchase RASCUNHO (Sprint 8b).
 *
 * Calcula em memória (sem aplicar) qual seria o efeito de confirmar a
 * compra: pra cada PurchaseItem com updateIngredientCost=true, lista
 * produtos afetados via RecipeItem, novo custo, novo CMV e sugestão
 * de novo preço de venda se ficar acima do targetCmv.
 *
 * Limitação consciente: não cascateia pra combos. Só efeito direto em
 * Product. Cascata real (recalculation.service) ainda é o caminho ao
 * confirmar; isso aqui é só pra mostrar a ordem de grandeza.
 */
import { prisma } from "@/lib/prisma";

export type IngredientImpact = {
  ingredientId: string;
  ingredientName: string;
  oldUnitCost: number;
  newUnitCost: number;
  deltaPct: number; // +/-
  affectedProducts: ProductImpact[];
};

export type ProductImpact = {
  productId: string;
  productName: string;
  oldTotalCost: number;
  newTotalCost: number;
  costDeltaPct: number;
  salePrice: number;
  currentCmv: number; // fração 0..1
  newCmv: number;
  targetCmv: number;
  overTarget: boolean;
  suggestedSalePrice: number | null;
};

export async function getPurchaseImpactPreview(
  purchaseId: string,
): Promise<IngredientImpact[]> {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      items: {
        where: { updateIngredientCost: true },
        include: {
          ingredient: {
            select: { id: true, name: true, unitCost: true },
          },
        },
      },
    },
  });
  if (!purchase) return [];

  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: {
      defaultCmvChicken: true,
      defaultCmvBeefRib: true,
      defaultCmvPork: true,
      defaultCmvSides: true,
      defaultCmvExtras: true,
      defaultCmvBeverages: true,
    },
  });

  const defaultCmvFor = (category: string): number => {
    switch (category) {
      case "FRANGO":
        return Number(settings?.defaultCmvChicken ?? 0.5);
      case "COSTELA":
        return Number(settings?.defaultCmvBeefRib ?? 0.5);
      case "SUINOS":
        return Number(settings?.defaultCmvPork ?? 0.5);
      case "ACOMPANHAMENTOS":
        return Number(settings?.defaultCmvSides ?? 0.35);
      case "EXTRAS":
        return Number(settings?.defaultCmvExtras ?? 0.35);
      case "BEBIDAS":
        return Number(settings?.defaultCmvBeverages ?? 0.7);
      default:
        return 0.5;
    }
  };

  const impacts: IngredientImpact[] = [];

  for (const item of purchase.items) {
    const oldCost = Number(item.ingredient.unitCost);
    const newCost = Number(item.unitCost);
    if (oldCost === newCost) continue;
    const deltaPct = oldCost > 0 ? ((newCost - oldCost) / oldCost) * 100 : 0;

    const recipeItems = await prisma.recipeItem.findMany({
      where: { ingredientId: item.ingredientId },
      include: {
        recipe: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                totalCost: true,
                salePrice: true,
                targetCmv: true,
                category: true,
              },
            },
          },
        },
      },
    });

    const affectedProducts: ProductImpact[] = recipeItems.map((ri) => {
      const p = ri.recipe.product;
      const qty = Number(ri.quantity);
      const oldContribution = qty * oldCost;
      const newContribution = qty * newCost;
      const delta = newContribution - oldContribution;
      const oldTotalCost = Number(p.totalCost);
      const newTotalCost = oldTotalCost + delta;
      const costDeltaPct =
        oldTotalCost > 0 ? ((newTotalCost - oldTotalCost) / oldTotalCost) * 100 : 0;
      const salePrice = Number(p.salePrice ?? 0);
      const currentCmv = salePrice > 0 ? oldTotalCost / salePrice : 0;
      const newCmv = salePrice > 0 ? newTotalCost / salePrice : 0;
      const targetCmv = p.targetCmv
        ? Number(p.targetCmv)
        : defaultCmvFor(p.category);
      const overTarget = salePrice > 0 && newCmv > targetCmv;
      const suggestedSalePrice =
        overTarget && targetCmv > 0
          ? Math.ceil((newTotalCost / targetCmv) * 100) / 100
          : null;
      return {
        productId: p.id,
        productName: p.name,
        oldTotalCost,
        newTotalCost,
        costDeltaPct,
        salePrice,
        currentCmv,
        newCmv,
        targetCmv,
        overTarget,
        suggestedSalePrice,
      };
    });

    impacts.push({
      ingredientId: item.ingredient.id,
      ingredientName: item.ingredient.name,
      oldUnitCost: oldCost,
      newUnitCost: newCost,
      deltaPct,
      affectedProducts,
    });
  }

  return impacts;
}
