/**
 * Agrega tudo que o dashboard precisa em uma única função.
 * Roda 4 queries em paralelo e calcula KPIs/alertas/dados de chart no JS.
 */
import { prisma } from "@/lib/prisma";
import { calculateCmv, calculateGrossProfit } from "@/domain/calculations";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/enums";
import {
  countEmptyButUsed,
  countExpiringSoon,
  countMovementsLast30Days,
} from "./stock.service";
import {
  countOpenSalesOlderThan24h,
  getRevenueLast30Days,
} from "./sales.service";
import { getCurrentMonthResult } from "./financial.service";
import { ProductCategory, SaleStatus } from "@prisma/client";

/**
 * Dashboard simplificado pro perfil OPERADOR — sem nada financeiro/CMV.
 * Foco: o que ele precisa pra operar (vendas em aberto, alertas de estoque,
 * volume do dia/30d) e atalhos pra ação imediata.
 */
export async function getOperatorDashboardData() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    settings,
    expiringSoonCount,
    emptyButUsedCount,
    openSalesCount,
    openSalesStale,
    salesTodayCount,
    salesLast30dCount,
    movementsTodayCount,
    movements30dCount,
  ] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    countExpiringSoon(7),
    countEmptyButUsed(),
    prisma.sale.count({ where: { status: SaleStatus.ABERTA } }),
    countOpenSalesOlderThan24h(),
    prisma.sale.count({
      where: { status: SaleStatus.CONCLUIDA, closedAt: { gte: startOfDay } },
    }),
    prisma.sale.count({
      where: {
        status: SaleStatus.CONCLUIDA,
        closedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.stockMovement.count({ where: { createdAt: { gte: startOfDay } } }),
    countMovementsLast30Days(),
  ]);

  const alerts: DashboardAlert[] = [];
  if (openSalesStale > 0) {
    alerts.push({
      id: "open-sales-stale",
      severity: "warning",
      title: `${openSalesStale} venda(s) em aberto há mais de 24h`,
      count: openSalesStale,
      href: "/vendas?status=ABERTA",
    });
  }
  if (emptyButUsedCount > 0) {
    alerts.push({
      id: "empty-stock",
      severity: "danger",
      title: `${emptyButUsedCount} ingrediente(s) usados zerados no estoque`,
      count: emptyButUsedCount,
      href: "/estoque",
    });
  }
  if (expiringSoonCount > 0) {
    alerts.push({
      id: "expiring-soon",
      severity: "warning",
      title: `${expiringSoonCount} lote(s) vencendo nos próximos 7 dias`,
      count: expiringSoonCount,
      href: "/estoque",
    });
  }

  return {
    settings,
    counts: {
      openSales: openSalesCount,
      salesToday: salesTodayCount,
      salesLast30Days: salesLast30dCount,
      movementsToday: movementsTodayCount,
      movementsLast30Days: movements30dCount,
    },
    alerts,
  };
}

export type AlertSeverity = "danger" | "warning" | "info";

export type DashboardAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  count: number;
  href: string;
};

export type CategoryCmvPoint = {
  category: string;
  avgCmv: number;
  count: number;
};

export type TopItemPoint = {
  name: string;
  value: number;
  cmv?: number;
};

export type CategoryDistPoint = {
  category: string;
  count: number;
};

export async function getDashboardData() {
  const [
    ingredients,
    products,
    combos,
    settings,
    expiringSoonCount,
    emptyButUsedCount,
    stockMovementsLast30Days,
    salesLast30Days,
    openSalesStale,
    currentMonth,
  ] = await Promise.all([
    prisma.ingredient.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        category: true,
        unitCost: true,
      },
    }),
    prisma.product.findMany({
      where: { active: true },
      include: {
        recipe: { select: { id: true, _count: { select: { items: true } } } },
      },
    }),
    prisma.combo.findMany({
      where: { active: true },
      include: { _count: { select: { items: true } } },
    }),
    prisma.settings.findUnique({ where: { id: 1 } }),
    countExpiringSoon(7),
    countEmptyButUsed(),
    countMovementsLast30Days(),
    getRevenueLast30Days(),
    countOpenSalesOlderThan24h(),
    getCurrentMonthResult(),
  ]);

  // ---------------- KPIs básicos ----------------
  const ingredientCount = ingredients.length;
  const productCount = products.length;
  const comboCount = combos.length;

  // ---------------- Cálculos por produto ----------------
  type ProductMetrics = {
    id: string;
    name: string;
    category: ProductCategory;
    cost: number;
    price: number;
    targetCmv: number;
    cmv: number | null;
    profit: number | null;
    hasNoCost: boolean;
    hasNoPrice: boolean;
    hasNoRecipe: boolean;
    aboveTarget: boolean;
  };

  const productMetrics: ProductMetrics[] = products.map((p) => {
    const cost = Number(p.totalCost);
    const price = p.salePrice ? Number(p.salePrice) : 0;
    const targetCmv = p.targetCmv ? Number(p.targetCmv) : 0.5;
    const cmv = price > 0 && cost > 0 ? Number(calculateCmv(cost, price)) : null;
    const profit = price > 0 ? Number(calculateGrossProfit(cost, price)) : null;
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      cost,
      price,
      targetCmv,
      cmv,
      profit,
      hasNoCost: cost === 0,
      hasNoPrice: price === 0,
      hasNoRecipe: !p.recipe || p.recipe._count.items === 0,
      aboveTarget: cmv !== null && cmv > targetCmv,
    };
  });

  // ---------------- Cálculos por combo ----------------
  type ComboMetrics = {
    id: string;
    name: string;
    category: ProductCategory;
    cost: number;
    price: number;
    targetCmv: number;
    cmv: number | null;
    profit: number | null;
    hasNoItems: boolean;
    hasNoPrice: boolean;
    aboveTarget: boolean;
  };

  const comboMetrics: ComboMetrics[] = combos.map((c) => {
    const cost = Number(c.totalCost);
    const price = c.salePrice ? Number(c.salePrice) : 0;
    const targetCmv = c.targetCmv ? Number(c.targetCmv) : 0.45;
    const cmv = price > 0 && cost > 0 ? Number(calculateCmv(cost, price)) : null;
    const profit = price > 0 ? Number(calculateGrossProfit(cost, price)) : null;
    return {
      id: c.id,
      name: c.name,
      category: c.category,
      cost,
      price,
      targetCmv,
      cmv,
      profit,
      hasNoItems: c._count.items === 0,
      hasNoPrice: price === 0,
      aboveTarget: cmv !== null && cmv > targetCmv,
    };
  });

  // ---------------- Counts ----------------
  const productsWithoutCost = productMetrics.filter((p) => p.hasNoCost).length;
  const productsWithoutPrice = productMetrics.filter((p) => p.hasNoPrice).length;
  const productsAboveCmv = productMetrics.filter((p) => p.aboveTarget).length;
  const productsWithoutRecipe = productMetrics.filter((p) => p.hasNoRecipe).length;

  const combosWithoutItems = comboMetrics.filter((c) => c.hasNoItems).length;
  const combosAboveCmv = comboMetrics.filter((c) => c.aboveTarget).length;

  const ingredientsWithoutPrice = ingredients.filter(
    (i) => Number(i.unitCost) === 0,
  ).length;

  // CMVs médios (apenas itens com cálculo válido)
  const productsWithCmv = productMetrics.filter((p) => p.cmv !== null);
  const avgProductCmv =
    productsWithCmv.length > 0
      ? productsWithCmv.reduce((acc, p) => acc + (p.cmv ?? 0), 0) / productsWithCmv.length
      : 0;

  const combosWithCmv = comboMetrics.filter((c) => c.cmv !== null);
  const avgComboCmv =
    combosWithCmv.length > 0
      ? combosWithCmv.reduce((acc, c) => acc + (c.cmv ?? 0), 0) / combosWithCmv.length
      : 0;

  // ---------------- Charts ----------------

  // CMV médio por categoria de produto
  const cmvByCategory: CategoryCmvPoint[] = (() => {
    const groups = new Map<ProductCategory, { sum: number; count: number }>();
    for (const p of productsWithCmv) {
      const g = groups.get(p.category) ?? { sum: 0, count: 0 };
      g.sum += p.cmv ?? 0;
      g.count += 1;
      groups.set(p.category, g);
    }
    return Array.from(groups.entries()).map(([cat, { sum, count }]) => ({
      category: PRODUCT_CATEGORY_LABEL[cat],
      avgCmv: count > 0 ? sum / count : 0,
      count,
    }));
  })();

  // Top 5 produtos com maior lucro bruto
  const topProductsByProfit: TopItemPoint[] = productMetrics
    .filter((p) => p.profit !== null)
    .sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0))
    .slice(0, 5)
    .map((p) => ({ name: p.name, value: p.profit ?? 0 }));

  // Top 5 produtos com maior CMV
  const topProductsByCmv: TopItemPoint[] = productMetrics
    .filter((p) => p.cmv !== null)
    .sort((a, b) => (b.cmv ?? 0) - (a.cmv ?? 0))
    .slice(0, 5)
    .map((p) => ({ name: p.name, value: p.cmv ?? 0, cmv: p.cmv ?? 0 }));

  // Top 5 combos por lucro bruto
  const topCombosByProfit: TopItemPoint[] = comboMetrics
    .filter((c) => c.profit !== null)
    .sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0))
    .slice(0, 5)
    .map((c) => ({ name: c.name, value: c.profit ?? 0 }));

  // Distribuição de produtos por categoria
  const categoryDistribution: CategoryDistPoint[] = (() => {
    const groups = new Map<ProductCategory, number>();
    for (const p of products) {
      groups.set(p.category, (groups.get(p.category) ?? 0) + 1);
    }
    return Array.from(groups.entries()).map(([cat, count]) => ({
      category: PRODUCT_CATEGORY_LABEL[cat],
      count,
    }));
  })();

  // ---------------- Alerts ----------------
  const alerts: DashboardAlert[] = [];

  if (productsWithoutCost > 0) {
    alerts.push({
      id: "products-without-cost",
      severity: "danger",
      title: "Produtos sem custo cadastrado",
      count: productsWithoutCost,
      href: "/relatorios/produtos-sem-custo",
    });
  }
  if (productsWithoutPrice > 0) {
    alerts.push({
      id: "products-without-price",
      severity: "warning",
      title: "Produtos sem preço de venda",
      count: productsWithoutPrice,
      href: "/relatorios/produtos-sem-preco",
    });
  }
  if (productsAboveCmv > 0) {
    alerts.push({
      id: "products-above-cmv",
      severity: "warning",
      title: "Produtos com CMV acima da meta",
      count: productsAboveCmv,
      href: "/relatorios/produtos-cmv?aboveTarget=1",
    });
  }
  if (productsWithoutRecipe > 0) {
    alerts.push({
      id: "products-without-recipe",
      severity: "info",
      title: "Produtos sem ficha técnica",
      count: productsWithoutRecipe,
      href: "/fichas-tecnicas?status=no_recipe",
    });
  }
  if (ingredientsWithoutPrice > 0) {
    alerts.push({
      id: "ingredients-without-price",
      severity: "danger",
      title: "Ingredientes sem preço de compra",
      count: ingredientsWithoutPrice,
      href: "/ingredientes",
    });
  }
  if (combosWithoutItems > 0) {
    alerts.push({
      id: "combos-without-items",
      severity: "danger",
      title: "Combos vazios (sem itens)",
      count: combosWithoutItems,
      href: "/combos",
    });
  }
  if (expiringSoonCount > 0) {
    alerts.push({
      id: "stock-expiring-soon",
      severity: "warning",
      title: "Itens vencendo em ≤ 7 dias",
      count: expiringSoonCount,
      href: "/estoque?filter=expiring",
    });
  }
  if (emptyButUsedCount > 0) {
    alerts.push({
      id: "stock-empty-but-used",
      severity: "danger",
      title: "Ingredientes sem saldo, mas usados em fichas",
      count: emptyButUsedCount,
      href: "/estoque?filter=empty",
    });
  }
  if (combosAboveCmv > 0) {
    alerts.push({
      id: "combos-above-cmv",
      severity: "warning",
      title: "Combos com margem abaixo da meta",
      count: combosAboveCmv,
      href: "/relatorios/combos-cmv?aboveTarget=1",
    });
  }
  if (openSalesStale > 0) {
    alerts.push({
      id: "sales-open-stale",
      severity: "warning",
      title: "Vendas em aberto há mais de 24h",
      count: openSalesStale,
      href: "/vendas?status=ABERTA",
    });
  }

  // ---------------- Faturamento alvo ----------------
  const monthlyRevenueTarget = settings
    ? Number(settings.targetAverageTicket) *
      settings.targetOrdersPerWeekend *
      settings.weekendsPerMonth
    : 0;

  return {
    counts: {
      ingredients: ingredientCount,
      products: productCount,
      combos: comboCount,
      stockMovementsLast30Days,
      salesLast30Days: salesLast30Days.count,
    },
    avg: {
      productCmv: avgProductCmv,
      comboCmv: avgComboCmv,
    },
    sales: salesLast30Days,
    currentMonth,
    issues: {
      productsWithoutCost,
      productsWithoutPrice,
      productsAboveCmv,
      productsWithoutRecipe,
      combosWithoutItems,
      combosAboveCmv,
      ingredientsWithoutPrice,
      expiringSoonCount,
      emptyButUsedCount,
    },
    settings,
    monthlyRevenueTarget,
    charts: {
      cmvByCategory,
      topProductsByProfit,
      topProductsByCmv,
      topCombosByProfit,
      categoryDistribution,
    },
    alerts,
  };
}
