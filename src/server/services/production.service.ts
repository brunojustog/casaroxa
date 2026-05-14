/**
 * Planejamento de produção (Sprint 3).
 *
 * Agrega todos os pedidos confirmados pra uma data alvo e gera:
 *   1. Lista de produção (produtos/combos a produzir, com quantidade total)
 *   2. Lista de compras (ingredientes consolidados, derivados via Recipe)
 *
 * Fontes de pedidos:
 *   - SalesEvent (pré-venda) com eventDate matching → usa
 *     SalesEventProduct.reservedQty (já agregado)
 *   - OrderRequest (encomenda) com requestedFor::date matching
 *     E status APROVADA/EM_PRODUCAO/PRONTA → soma items
 *
 * Não inclui Sales avulsas (sem data desejada) — essas ficam no KDS.
 * Resultado é computado on-the-fly, sem persistir (MVP).
 */
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";

export type ProductionItem = {
  kind: "PRODUTO" | "COMBO";
  id: string;
  name: string;
  quantity: number;
  sources: { fromPreSale: number; fromEncomenda: number };
};

export type ShoppingItem = {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  totalQuantity: number;
  estimatedCostCents: number;
  breakdown: Array<{ source: string; quantity: number }>;
};

export type ProductionPlan = {
  date: string; // YYYY-MM-DD
  productionList: ProductionItem[];
  shoppingList: ShoppingItem[];
  summary: {
    preSaleCount: number;
    orderRequestCount: number;
    totalCostCents: number;
  };
};

/**
 * Constrói o plano de produção pra uma data específica.
 * Date é interpretada no fuso local — passa "2026-05-31" e ele agrega
 * tudo daquele dia (00:00:00 a 23:59:59 local).
 */
export async function getProductionPlanForDate(
  dateISO: string,
): Promise<ProductionPlan> {
  const [year, month, day] = dateISO.split("-").map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

  // ----- 1. Coletar pedidos das fontes -----
  const [salesEvents, orderRequests] = await Promise.all([
    prisma.salesEvent.findMany({
      where: {
        eventDate: dayStart,
        status: { in: ["OPEN", "CLOSED"] },
      },
      include: {
        products: {
          include: {
            product: { select: { id: true, name: true } },
            combo: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.orderRequest.findMany({
      where: {
        requestedFor: { gte: dayStart, lte: dayEnd },
        status: { in: ["APROVADA", "EM_PRODUCAO", "PRONTA"] },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            combo: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  // ----- 2. Agregar production list por (kind, id) -----
  const productionMap = new Map<string, ProductionItem>();
  const keyOf = (kind: "PRODUTO" | "COMBO", id: string) => `${kind}:${id}`;

  for (const ev of salesEvents) {
    for (const sep of ev.products) {
      if (sep.reservedQty <= 0) continue;
      const product = sep.product;
      const combo = sep.combo;
      const kind = product ? "PRODUTO" : "COMBO";
      const id = product?.id ?? combo?.id;
      const name = product?.name ?? combo?.name;
      if (!id || !name) continue;
      const k = keyOf(kind, id);
      const existing = productionMap.get(k);
      if (existing) {
        existing.quantity += sep.reservedQty;
        existing.sources.fromPreSale += sep.reservedQty;
      } else {
        productionMap.set(k, {
          kind,
          id,
          name,
          quantity: sep.reservedQty,
          sources: { fromPreSale: sep.reservedQty, fromEncomenda: 0 },
        });
      }
    }
  }

  for (const req of orderRequests) {
    for (const it of req.items) {
      const qty = Number(it.quantity);
      if (qty <= 0) continue;
      const product = it.product;
      const combo = it.combo;
      const kind = product ? "PRODUTO" : "COMBO";
      const id = product?.id ?? combo?.id;
      const name = product?.name ?? combo?.name;
      if (!id || !name) continue;
      const k = keyOf(kind, id);
      const existing = productionMap.get(k);
      if (existing) {
        existing.quantity += qty;
        existing.sources.fromEncomenda += qty;
      } else {
        productionMap.set(k, {
          kind,
          id,
          name,
          quantity: qty,
          sources: { fromPreSale: 0, fromEncomenda: qty },
        });
      }
    }
  }

  const productionList = Array.from(productionMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );

  // ----- 3. Derivar shopping list explodindo Recipes -----
  const productIds = new Set<string>();
  const comboIds = new Set<string>();
  for (const p of productionList) {
    if (p.kind === "PRODUTO") productIds.add(p.id);
    else comboIds.add(p.id);
  }

  // Recipes diretas dos produtos
  const directRecipes = productIds.size
    ? await prisma.recipe.findMany({
        where: { productId: { in: Array.from(productIds) } },
        include: {
          items: {
            include: {
              ingredient: { select: { id: true, name: true, unit: true } },
            },
          },
        },
      })
    : [];
  const recipeByProductId = new Map(directRecipes.map((r) => [r.productId, r]));

  // Combos: precisamos do ComboItem → Product → Recipe
  const combos = comboIds.size
    ? await prisma.combo.findMany({
        where: { id: { in: Array.from(comboIds) } },
        include: {
          items: {
            include: {
              product: {
                include: {
                  recipe: {
                    include: {
                      items: {
                        include: {
                          ingredient: {
                            select: { id: true, name: true, unit: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : [];
  const comboById = new Map(combos.map((c) => [c.id, c]));

  // Agora consolida ingredientes
  type IngrAgg = {
    ingredientId: string;
    ingredientName: string;
    unit: string;
    totalQuantity: number;
    estimatedCostCents: number;
    breakdown: Array<{ source: string; quantity: number }>;
  };
  const ingrMap = new Map<string, IngrAgg>();

  function addIngredient(args: {
    ingredientId: string;
    ingredientName: string;
    unit: string;
    quantity: number;
    unitCost: number; // R$
    source: string;
  }) {
    const existing = ingrMap.get(args.ingredientId);
    const costCents = Math.round(args.quantity * args.unitCost * 100);
    if (existing) {
      existing.totalQuantity += args.quantity;
      existing.estimatedCostCents += costCents;
      existing.breakdown.push({ source: args.source, quantity: args.quantity });
    } else {
      ingrMap.set(args.ingredientId, {
        ingredientId: args.ingredientId,
        ingredientName: args.ingredientName,
        unit: args.unit,
        totalQuantity: args.quantity,
        estimatedCostCents: costCents,
        breakdown: [{ source: args.source, quantity: args.quantity }],
      });
    }
  }

  for (const prodItem of productionList) {
    if (prodItem.kind === "PRODUTO") {
      const recipe = recipeByProductId.get(prodItem.id);
      if (!recipe) continue;
      for (const ri of recipe.items) {
        const qty = toDecimal(ri.quantity).mul(prodItem.quantity).toNumber();
        addIngredient({
          ingredientId: ri.ingredient.id,
          ingredientName: ri.ingredient.name,
          unit: ri.ingredient.unit,
          quantity: qty,
          unitCost: Number(ri.unitCostSnapshot),
          source: `${prodItem.quantity}× ${prodItem.name}`,
        });
      }
    } else {
      const combo = comboById.get(prodItem.id);
      if (!combo) continue;
      for (const ci of combo.items) {
        const recipe = ci.product?.recipe;
        if (!recipe) continue;
        // qty do ingrediente = comboQty × comboItemQty × recipeItemQty
        const productQtyInCombo = toDecimal(ci.quantity).mul(prodItem.quantity);
        for (const ri of recipe.items) {
          const qty = toDecimal(ri.quantity).mul(productQtyInCombo).toNumber();
          addIngredient({
            ingredientId: ri.ingredient.id,
            ingredientName: ri.ingredient.name,
            unit: ri.ingredient.unit,
            quantity: qty,
            unitCost: Number(ri.unitCostSnapshot),
            source: `${prodItem.quantity}× ${prodItem.name}`,
          });
        }
      }
    }
  }

  const shoppingList: ShoppingItem[] = Array.from(ingrMap.values()).sort(
    (a, b) => a.ingredientName.localeCompare(b.ingredientName, "pt-BR"),
  );

  const totalCostCents = shoppingList.reduce(
    (acc, it) => acc + it.estimatedCostCents,
    0,
  );

  return {
    date: dateISO,
    productionList,
    shoppingList,
    summary: {
      preSaleCount: salesEvents.length,
      orderRequestCount: orderRequests.length,
      totalCostCents,
    },
  };
}
