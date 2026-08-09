/**
 * Upsells no checkout (Sprint 7b).
 *
 * Estratégia "categoria complementar" — sem ML, sem histórico necessário.
 * Regras:
 *   - Se cart tem proteína (FRANGO/COSTELA/SUINOS) mas falta ACOMPANHAMENTOS
 *     → sugere top N acompanhamentos
 *   - Se tem qualquer comida (proteína OU acompanhamento) sem BEBIDAS
 *     → sugere top N bebidas
 *
 * "Top N" hoje é alfabético filtrando active=true + showInMenu=true.
 * Quando houver histórico, dá pra evoluir pra ranking por contagem
 * de SaleItem (mais comprados no geral) sem mudar a API.
 */
import { ProductCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PROTEIN_CATEGORIES: ProductCategory[] = ["FRANGO", "COSTELA", "SUINOS"];

export type UpsellSuggestion = {
  id: string;
  kind: "PRODUTO";
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  category: ProductCategory;
  reason: string;
  requiresKitchen: boolean;
};

export async function getUpsellsForCart(input: {
  items: Array<{ id: string; kind: "PRODUTO" | "COMBO" }>;
}): Promise<UpsellSuggestion[]> {
  if (input.items.length === 0) return [];

  const productIds = input.items
    .filter((i) => i.kind === "PRODUTO")
    .map((i) => i.id);
  const comboIds = input.items.filter((i) => i.kind === "COMBO").map((i) => i.id);

  // Categorias presentes (do produto + dos produtos dentro dos combos)
  const [products, combos] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { category: true },
        })
      : Promise.resolve([]),
    comboIds.length
      ? prisma.combo.findMany({
          where: { id: { in: comboIds } },
          select: {
            category: true,
            items: { select: { product: { select: { category: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const presentCategories = new Set<ProductCategory>();
  for (const p of products) presentCategories.add(p.category);
  for (const c of combos) {
    presentCategories.add(c.category);
    for (const ci of c.items) {
      if (ci.product?.category) presentCategories.add(ci.product.category);
    }
  }

  const hasProtein = PROTEIN_CATEGORIES.some((cat) =>
    presentCategories.has(cat),
  );
  const hasFood =
    hasProtein || presentCategories.has("ACOMPANHAMENTOS");
  const hasSides = presentCategories.has("ACOMPANHAMENTOS");
  const hasDrinks = presentCategories.has("BEBIDAS");

  const suggestions: UpsellSuggestion[] = [];
  const cartProductIds = new Set(productIds);

  // Acompanhamento se tem proteína sem acompanhamento
  if (hasProtein && !hasSides) {
    const sides = await prisma.product.findMany({
      where: {
        active: true,
        showInMenu: true,
        category: "ACOMPANHAMENTOS",
        salePrice: { gt: 0 },
        id: { notIn: Array.from(cartProductIds) },
      },
      orderBy: { name: "asc" },
      take: 3,
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        salePrice: true,
        category: true,
        requiresKitchen: true,
      },
    });
    for (const s of sides) {
      suggestions.push({
        id: s.id,
        kind: "PRODUTO",
        name: s.name,
        description: s.description,
        imageUrl: s.imageUrl,
        price: Number(s.salePrice ?? 0),
        category: s.category,
        reason: "Pra acompanhar",
        requiresKitchen: s.requiresKitchen,
      });
    }
  }

  // Bebida se tem comida sem bebida
  if (hasFood && !hasDrinks) {
    const drinks = await prisma.product.findMany({
      where: {
        active: true,
        showInMenu: true,
        category: "BEBIDAS",
        salePrice: { gt: 0 },
        id: { notIn: Array.from(cartProductIds) },
      },
      orderBy: { name: "asc" },
      take: 3,
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        salePrice: true,
        category: true,
        requiresKitchen: true,
      },
    });
    for (const d of drinks) {
      suggestions.push({
        id: d.id,
        kind: "PRODUTO",
        name: d.name,
        description: d.description,
        imageUrl: d.imageUrl,
        price: Number(d.salePrice ?? 0),
        category: d.category,
        reason: "Pra beber junto",
        requiresKitchen: d.requiresKitchen,
      });
    }
  }

  return suggestions;
}
