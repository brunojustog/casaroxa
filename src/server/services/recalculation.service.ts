/**
 * Lógica central de cascata de recálculo:
 *
 *   Ingrediente.preço muda
 *     → RecipeItem.unitCostSnapshot/totalCost atualizam
 *     → Recipe.totalCost soma os itens
 *     → Product.totalCost = Recipe.totalCost
 *     → ComboItem.unitCostSnapshot/totalCost atualizam
 *     → Combo.totalCost soma os itens
 *
 * Tudo opera dentro de uma `Prisma.TransactionClient` recebida por parâmetro,
 * para que cada chamada acontece dentro de uma transação maior.
 */
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/decimal";

/**
 * Recalcula totalCost de uma Recipe a partir dos seus RecipeItems atuais
 * e propaga para Product.totalCost + cascata para combos.
 */
export async function recalculateRecipeAndCascade(
  tx: Prisma.TransactionClient,
  recipeId: string,
): Promise<{ productId: string; recipeTotal: number }> {
  const items = await tx.recipeItem.findMany({
    where: { recipeId },
    select: { totalCost: true },
  });
  const recipeTotal = items.reduce((acc, it) => acc + Number(it.totalCost), 0);

  const recipe = await tx.recipe.update({
    where: { id: recipeId },
    data: { totalCost: recipeTotal },
    select: { productId: true },
  });

  await tx.product.update({
    where: { id: recipe.productId },
    data: { totalCost: recipeTotal },
  });

  await cascadeProductCostToCombos(tx, recipe.productId, recipeTotal);

  return { productId: recipe.productId, recipeTotal };
}

/**
 * Atualiza o snapshot de custo nos RecipeItems que usam um ingrediente
 * cujo preço mudou, e cascata recipe→product→combos.
 */
export async function applyIngredientPriceChange(
  tx: Prisma.TransactionClient,
  ingredientId: string,
  newUnitCost: number,
): Promise<void> {
  const items = await tx.recipeItem.findMany({
    where: { ingredientId },
    select: { id: true, recipeId: true, quantity: true },
  });

  const recipeIds = new Set<string>();
  for (const item of items) {
    const totalCost = toDecimal(item.quantity).mul(newUnitCost).toNumber();
    await tx.recipeItem.update({
      where: { id: item.id },
      data: {
        unitCostSnapshot: newUnitCost,
        totalCost,
      },
    });
    recipeIds.add(item.recipeId);
  }

  for (const recipeId of recipeIds) {
    await recalculateRecipeAndCascade(tx, recipeId);
  }
}

/**
 * Quando o custo de um produto mudou (via edição da ficha técnica),
 * atualiza ComboItem.unitCostSnapshot/totalCost e Combo.totalCost
 * para todos os combos que usam esse produto.
 */
export async function cascadeProductCostToCombos(
  tx: Prisma.TransactionClient,
  productId: string,
  newProductCost: number,
): Promise<void> {
  const items = await tx.comboItem.findMany({
    where: { productId },
    select: { id: true, comboId: true, quantity: true },
  });

  const comboIds = new Set<string>();
  for (const item of items) {
    const totalCost = toDecimal(item.quantity).mul(newProductCost).toNumber();
    await tx.comboItem.update({
      where: { id: item.id },
      data: {
        unitCostSnapshot: newProductCost,
        totalCost,
      },
    });
    comboIds.add(item.comboId);
  }

  for (const comboId of comboIds) {
    const allItems = await tx.comboItem.findMany({
      where: { comboId },
      select: { totalCost: true },
    });
    const comboTotal = allItems.reduce((acc, it) => acc + Number(it.totalCost), 0);
    await tx.combo.update({
      where: { id: comboId },
      data: { totalCost: comboTotal },
    });
  }
}
