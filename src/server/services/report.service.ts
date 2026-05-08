/**
 * Registry de relatórios.
 *
 * Cada relatório define:
 *  - title/description (header)
 *  - filters (campos do form de filtro, mapeado para search params)
 *  - columns (renderização de tabela e export)
 *  - fetch (Prisma query → linhas)
 *
 * O dispatcher genérico (`/relatorios/[tipo]`) e os endpoints de export
 * (`/api/export/{csv,pdf}`) consomem este mesmo registry.
 */
import { prisma } from "@/lib/prisma";
import { calculateCmv, calculateGrossProfit } from "@/domain/calculations";
import {
  INGREDIENT_CATEGORY_LABEL,
  INGREDIENT_UNIT_LABEL,
  PRODUCT_CATEGORY_LABEL,
} from "@/lib/enums";
import type { IngredientCategory, ProductCategory } from "@prisma/client";

// ---------- Tipos ----------

export type ReportFormat = "money" | "percent" | "number" | "date" | "datetime" | "text" | "integer";

export type ReportColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: ReportFormat;
};

export type ReportFilterKind =
  | { kind: "search"; key: string; placeholder: string }
  | { kind: "productCategory"; key: string; label?: string }
  | { kind: "ingredientCategory"; key: string; label?: string }
  | { kind: "boolean"; key: string; label: string };

export type ReportRow = Record<string, string | number | null | undefined>;

export type ReportDefinition = {
  type: string;
  title: string;
  description: string;
  filters: ReportFilterKind[];
  columns: ReportColumn[];
  fetch: (params: URLSearchParams) => Promise<ReportRow[]>;
};

// ---------- Helpers ----------

function param(p: URLSearchParams, key: string) {
  const v = p.get(key);
  return v && v.length > 0 ? v : undefined;
}

function paramBool(p: URLSearchParams, key: string) {
  return p.get(key) === "1" || p.get(key) === "true";
}

// ============================================================
// 1. Produtos por CMV
// ============================================================
const produtosCmv: ReportDefinition = {
  type: "produtos-cmv",
  title: "Produtos por CMV",
  description: "Produtos ordenados por CMV (do maior para o menor). Use para identificar onde o custo está alto demais.",
  filters: [
    { kind: "productCategory", key: "category" },
    { kind: "boolean", key: "aboveTarget", label: "Apenas acima da meta" },
  ],
  columns: [
    { key: "name", label: "Produto" },
    { key: "category", label: "Categoria" },
    { key: "cost", label: "Custo", align: "right", format: "money" },
    { key: "price", label: "Preço", align: "right", format: "money" },
    { key: "cmv", label: "CMV", align: "right", format: "percent" },
    { key: "target", label: "Meta", align: "right", format: "percent" },
    { key: "gap", label: "Gap (CMV − meta)", align: "right", format: "percent" },
  ],
  async fetch(p) {
    const category = param(p, "category") as ProductCategory | undefined;
    const aboveTarget = paramBool(p, "aboveTarget");

    const rows = await prisma.product.findMany({
      where: { active: true, ...(category ? { category } : {}) },
      select: {
        id: true,
        name: true,
        category: true,
        totalCost: true,
        salePrice: true,
        targetCmv: true,
      },
    });

    const enriched = rows
      .filter((p) => p.salePrice && Number(p.salePrice) > 0)
      .map((p) => {
        const cost = Number(p.totalCost);
        const price = Number(p.salePrice);
        const cmv = Number(calculateCmv(cost, price));
        const target = p.targetCmv ? Number(p.targetCmv) : 0.5;
        return {
          name: p.name,
          category: PRODUCT_CATEGORY_LABEL[p.category],
          cost,
          price,
          cmv,
          target,
          gap: cmv - target,
        };
      })
      .sort((a, b) => b.cmv - a.cmv);

    return aboveTarget ? enriched.filter((r) => r.cmv > r.target) : enriched;
  },
};

// ============================================================
// 2. Produtos mais lucrativos
// ============================================================
const produtosLucro: ReportDefinition = {
  type: "produtos-lucro",
  title: "Produtos mais lucrativos",
  description: "Produtos ordenados por lucro bruto absoluto.",
  filters: [{ kind: "productCategory", key: "category" }],
  columns: [
    { key: "name", label: "Produto" },
    { key: "category", label: "Categoria" },
    { key: "cost", label: "Custo", align: "right", format: "money" },
    { key: "price", label: "Preço", align: "right", format: "money" },
    { key: "profit", label: "Lucro bruto", align: "right", format: "money" },
    { key: "cmv", label: "CMV", align: "right", format: "percent" },
  ],
  async fetch(p) {
    const category = param(p, "category") as ProductCategory | undefined;
    const rows = await prisma.product.findMany({
      where: { active: true, ...(category ? { category } : {}) },
      select: {
        name: true,
        category: true,
        totalCost: true,
        salePrice: true,
      },
    });
    return rows
      .filter((p) => p.salePrice && Number(p.salePrice) > 0)
      .map((p) => {
        const cost = Number(p.totalCost);
        const price = Number(p.salePrice);
        return {
          name: p.name,
          category: PRODUCT_CATEGORY_LABEL[p.category],
          cost,
          price,
          profit: Number(calculateGrossProfit(cost, price)),
          cmv: Number(calculateCmv(cost, price)),
        };
      })
      .sort((a, b) => Number(b.profit) - Number(a.profit));
  },
};

// ============================================================
// 3. Produtos sem preço
// ============================================================
const produtosSemPreco: ReportDefinition = {
  type: "produtos-sem-preco",
  title: "Produtos sem preço",
  description: "Produtos ativos sem preço de venda definido.",
  filters: [{ kind: "productCategory", key: "category" }],
  columns: [
    { key: "name", label: "Produto" },
    { key: "category", label: "Categoria" },
    { key: "cost", label: "Custo atual", align: "right", format: "money" },
    { key: "target", label: "Meta CMV", align: "right", format: "percent" },
    { key: "suggested", label: "Preço sugerido", align: "right", format: "money" },
  ],
  async fetch(p) {
    const category = param(p, "category") as ProductCategory | undefined;
    const rows = await prisma.product.findMany({
      where: {
        active: true,
        OR: [{ salePrice: null }, { salePrice: 0 }],
        ...(category ? { category } : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { name: true, category: true, totalCost: true, targetCmv: true },
    });
    return rows.map((p) => {
      const cost = Number(p.totalCost);
      const target = p.targetCmv ? Number(p.targetCmv) : 0.5;
      return {
        name: p.name,
        category: PRODUCT_CATEGORY_LABEL[p.category],
        cost,
        target,
        suggested: target > 0 && cost > 0 ? cost / target : 0,
      };
    });
  },
};

// ============================================================
// 4. Produtos sem custo
// ============================================================
const produtosSemCusto: ReportDefinition = {
  type: "produtos-sem-custo",
  title: "Produtos sem custo",
  description: "Produtos ativos com custo zero — provavelmente sem ficha técnica ou ficha vazia.",
  filters: [{ kind: "productCategory", key: "category" }],
  columns: [
    { key: "name", label: "Produto" },
    { key: "category", label: "Categoria" },
    { key: "price", label: "Preço de venda", align: "right", format: "money" },
    { key: "items", label: "Itens na ficha", align: "right", format: "integer" },
  ],
  async fetch(p) {
    const category = param(p, "category") as ProductCategory | undefined;
    const rows = await prisma.product.findMany({
      where: { active: true, totalCost: 0, ...(category ? { category } : {}) },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { recipe: { include: { _count: { select: { items: true } } } } },
    });
    return rows.map((p) => ({
      name: p.name,
      category: PRODUCT_CATEGORY_LABEL[p.category],
      price: p.salePrice ? Number(p.salePrice) : 0,
      items: p.recipe?._count.items ?? 0,
    }));
  },
};

// ============================================================
// 5. Ingredientes mais caros
// ============================================================
const ingredientesCaros: ReportDefinition = {
  type: "ingredientes-caros",
  title: "Ingredientes mais caros",
  description: "Ingredientes ordenados pelo custo unitário (na unidade base).",
  filters: [{ kind: "ingredientCategory", key: "category" }],
  columns: [
    { key: "name", label: "Ingrediente" },
    { key: "category", label: "Categoria" },
    { key: "unit", label: "Unidade" },
    { key: "unitCost", label: "Custo unit.", align: "right", format: "money" },
    { key: "supplier", label: "Fornecedor" },
  ],
  async fetch(p) {
    const category = param(p, "category") as IngredientCategory | undefined;
    const rows = await prisma.ingredient.findMany({
      where: { active: true, ...(category ? { category } : {}) },
      orderBy: { unitCost: "desc" },
    });
    return rows.map((i) => ({
      name: i.name,
      category: INGREDIENT_CATEGORY_LABEL[i.category],
      unit: INGREDIENT_UNIT_LABEL[i.unit],
      unitCost: Number(i.unitCost),
      supplier: i.supplier ?? "—",
    }));
  },
};

// ============================================================
// 6. Ingredientes mais usados
// ============================================================
const ingredientesUsados: ReportDefinition = {
  type: "ingredientes-usados",
  title: "Ingredientes mais usados",
  description: "Ingredientes ordenados por número de fichas técnicas que os referenciam.",
  filters: [{ kind: "ingredientCategory", key: "category" }],
  columns: [
    { key: "name", label: "Ingrediente" },
    { key: "category", label: "Categoria" },
    { key: "unit", label: "Unidade" },
    { key: "unitCost", label: "Custo unit.", align: "right", format: "money" },
    { key: "usage", label: "Em fichas", align: "right", format: "integer" },
  ],
  async fetch(p) {
    const category = param(p, "category") as IngredientCategory | undefined;
    const rows = await prisma.ingredient.findMany({
      where: { active: true, ...(category ? { category } : {}) },
      include: { _count: { select: { recipeItems: true } } },
    });
    return rows
      .map((i) => ({
        name: i.name,
        category: INGREDIENT_CATEGORY_LABEL[i.category],
        unit: INGREDIENT_UNIT_LABEL[i.unit],
        unitCost: Number(i.unitCost),
        usage: i._count.recipeItems,
      }))
      .sort((a, b) => b.usage - a.usage);
  },
};

// ============================================================
// 7. Combos por lucro bruto
// ============================================================
const combosLucro: ReportDefinition = {
  type: "combos-lucro",
  title: "Combos por lucro bruto",
  description: "Combos ordenados por lucro bruto (preço − custo).",
  filters: [{ kind: "productCategory", key: "category" }],
  columns: [
    { key: "name", label: "Combo" },
    { key: "category", label: "Categoria" },
    { key: "cost", label: "Custo", align: "right", format: "money" },
    { key: "price", label: "Preço", align: "right", format: "money" },
    { key: "profit", label: "Lucro bruto", align: "right", format: "money" },
    { key: "cmv", label: "CMV", align: "right", format: "percent" },
  ],
  async fetch(p) {
    const category = param(p, "category") as ProductCategory | undefined;
    const rows = await prisma.combo.findMany({
      where: { active: true, ...(category ? { category } : {}) },
    });
    return rows
      .filter((c) => c.salePrice && Number(c.salePrice) > 0)
      .map((c) => {
        const cost = Number(c.totalCost);
        const price = Number(c.salePrice);
        return {
          name: c.name,
          category: PRODUCT_CATEGORY_LABEL[c.category],
          cost,
          price,
          profit: Number(calculateGrossProfit(cost, price)),
          cmv: Number(calculateCmv(cost, price)),
        };
      })
      .sort((a, b) => b.profit - a.profit);
  },
};

// ============================================================
// 8. Combos por CMV
// ============================================================
const combosCmv: ReportDefinition = {
  type: "combos-cmv",
  title: "Combos por CMV",
  description: "Combos ordenados por CMV (do maior para o menor).",
  filters: [
    { kind: "productCategory", key: "category" },
    { kind: "boolean", key: "aboveTarget", label: "Apenas acima da meta" },
  ],
  columns: [
    { key: "name", label: "Combo" },
    { key: "category", label: "Categoria" },
    { key: "cost", label: "Custo", align: "right", format: "money" },
    { key: "price", label: "Preço", align: "right", format: "money" },
    { key: "cmv", label: "CMV", align: "right", format: "percent" },
    { key: "target", label: "Meta", align: "right", format: "percent" },
    { key: "gap", label: "Gap", align: "right", format: "percent" },
  ],
  async fetch(p) {
    const category = param(p, "category") as ProductCategory | undefined;
    const aboveTarget = paramBool(p, "aboveTarget");
    const rows = await prisma.combo.findMany({
      where: { active: true, ...(category ? { category } : {}) },
    });
    const enriched = rows
      .filter((c) => c.salePrice && Number(c.salePrice) > 0)
      .map((c) => {
        const cost = Number(c.totalCost);
        const price = Number(c.salePrice);
        const cmv = Number(calculateCmv(cost, price));
        const target = c.targetCmv ? Number(c.targetCmv) : 0.45;
        return {
          name: c.name,
          category: PRODUCT_CATEGORY_LABEL[c.category],
          cost,
          price,
          cmv,
          target,
          gap: cmv - target,
        };
      })
      .sort((a, b) => b.cmv - a.cmv);
    return aboveTarget ? enriched.filter((r) => r.cmv > r.target) : enriched;
  },
};

// ============================================================
// 9. Fichas técnicas pendentes de revisão
// ============================================================
const fichasPendentes: ReportDefinition = {
  type: "fichas-pendentes",
  title: "Fichas técnicas pendentes de revisão",
  description: "Fichas com itens, mas que ainda não foram marcadas como revisadas.",
  filters: [{ kind: "productCategory", key: "category" }],
  columns: [
    { key: "name", label: "Produto" },
    { key: "category", label: "Categoria" },
    { key: "items", label: "Itens", align: "right", format: "integer" },
    { key: "cost", label: "Custo", align: "right", format: "money" },
    { key: "responsible", label: "Responsável" },
    { key: "lastEdit", label: "Última edição", format: "datetime" },
  ],
  async fetch(p) {
    const category = param(p, "category") as ProductCategory | undefined;
    const rows = await prisma.product.findMany({
      where: {
        active: true,
        ...(category ? { category } : {}),
        recipe: { reviewed: false },
      },
      include: {
        recipe: {
          include: { _count: { select: { items: true } } },
        },
      },
      orderBy: { name: "asc" },
    });
    return rows
      .filter((p) => p.recipe && p.recipe._count.items > 0)
      .map((p) => ({
        name: p.name,
        category: PRODUCT_CATEGORY_LABEL[p.category],
        items: p.recipe!._count.items,
        cost: Number(p.totalCost),
        responsible: p.recipe!.responsible ?? "—",
        lastEdit: p.recipe!.updatedAt.toISOString(),
      }));
  },
};

// ============================================================
// 10. Histórico de alteração de preços de ingredientes
// ============================================================
const histPrecosIng: ReportDefinition = {
  type: "hist-precos-ingredientes",
  title: "Histórico de preços de ingredientes",
  description: "Mudanças recentes de preço de ingredientes (limite 200 últimas).",
  filters: [{ kind: "search", key: "search", placeholder: "Buscar ingrediente…" }],
  columns: [
    { key: "changedAt", label: "Data", format: "datetime" },
    { key: "ingredient", label: "Ingrediente" },
    { key: "oldPrice", label: "Preço anterior", align: "right", format: "money" },
    { key: "newPrice", label: "Preço novo", align: "right", format: "money" },
    { key: "delta", label: "Variação", align: "right", format: "percent" },
    { key: "user", label: "Usuário" },
  ],
  async fetch(p) {
    const search = param(p, "search");
    const rows = await prisma.ingredientPriceHistory.findMany({
      where: search
        ? { ingredient: { name: { contains: search, mode: "insensitive" } } }
        : undefined,
      include: {
        ingredient: { select: { name: true } },
        changedBy: { select: { name: true } },
      },
      orderBy: { changedAt: "desc" },
      take: 200,
    });
    return rows.map((h) => {
      const oldP = Number(h.oldPrice);
      const newP = Number(h.newPrice);
      return {
        changedAt: h.changedAt.toISOString(),
        ingredient: h.ingredient.name,
        oldPrice: oldP,
        newPrice: newP,
        delta: oldP > 0 ? (newP - oldP) / oldP : 0,
        user: h.changedBy?.name ?? "—",
      };
    });
  },
};

// ============================================================
// 11. Histórico de preços de venda
// ============================================================
const histPrecosVenda: ReportDefinition = {
  type: "hist-precos-venda",
  title: "Histórico de preços de venda",
  description: "Mudanças recentes de preço de venda dos produtos (limite 200 últimas).",
  filters: [{ kind: "search", key: "search", placeholder: "Buscar produto…" }],
  columns: [
    { key: "changedAt", label: "Data", format: "datetime" },
    { key: "product", label: "Produto" },
    { key: "oldPrice", label: "Preço anterior", align: "right", format: "money" },
    { key: "newPrice", label: "Preço novo", align: "right", format: "money" },
    { key: "delta", label: "Variação", align: "right", format: "percent" },
  ],
  async fetch(p) {
    const search = param(p, "search");
    const rows = await prisma.productPriceHistory.findMany({
      where: search
        ? { product: { name: { contains: search, mode: "insensitive" } } }
        : undefined,
      include: { product: { select: { name: true } } },
      orderBy: { changedAt: "desc" },
      take: 200,
    });
    return rows.map((h) => {
      const oldP = h.oldPrice ? Number(h.oldPrice) : 0;
      const newP = h.newPrice ? Number(h.newPrice) : 0;
      return {
        changedAt: h.changedAt.toISOString(),
        product: h.product.name,
        oldPrice: oldP,
        newPrice: newP,
        delta: oldP > 0 ? (newP - oldP) / oldP : 0,
      };
    });
  },
};

// ============================================================
// 12. Cenários salvos
// ============================================================
const cenariosSalvos: ReportDefinition = {
  type: "cenarios-salvos",
  title: "Cenários salvos",
  description: "Snapshot de todos os cenários cadastrados com seus resultados.",
  filters: [],
  columns: [
    { key: "name", label: "Cenário" },
    { key: "orders", label: "Pedidos/FdS", align: "right", format: "integer" },
    { key: "ticket", label: "Ticket médio", align: "right", format: "money" },
    { key: "cmv", label: "CMV est.", align: "right", format: "percent" },
    { key: "monthlyRevenue", label: "Faturamento mensal", align: "right", format: "money" },
    { key: "grossProfit", label: "Lucro bruto", align: "right", format: "money" },
    { key: "fixedCost", label: "Custo fixo", align: "right", format: "money" },
    { key: "result", label: "Resultado", align: "right", format: "money" },
    { key: "payback", label: "Payback (meses)", align: "right", format: "number" },
  ],
  async fetch() {
    const rows = await prisma.scenario.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((s) => ({
      name: s.name,
      orders: s.ordersPerWeekend,
      ticket: Number(s.averageTicket),
      cmv: Number(s.estimatedCmvPercent),
      monthlyRevenue: Number(s.monthlyRevenue),
      grossProfit: Number(s.grossProfit),
      fixedCost: Number(s.fixedCost),
      result: Number(s.estimatedResult),
      payback: s.paybackMonths ? Number(s.paybackMonths) : null,
    }));
  },
};

// ============================================================
// REGISTRY
// ============================================================
export const REPORTS: Record<string, ReportDefinition> = {
  [produtosCmv.type]: produtosCmv,
  [produtosLucro.type]: produtosLucro,
  [produtosSemPreco.type]: produtosSemPreco,
  [produtosSemCusto.type]: produtosSemCusto,
  [ingredientesCaros.type]: ingredientesCaros,
  [ingredientesUsados.type]: ingredientesUsados,
  [combosLucro.type]: combosLucro,
  [combosCmv.type]: combosCmv,
  [fichasPendentes.type]: fichasPendentes,
  [histPrecosIng.type]: histPrecosIng,
  [histPrecosVenda.type]: histPrecosVenda,
  [cenariosSalvos.type]: cenariosSalvos,
};

export const REPORT_LIST: ReportDefinition[] = Object.values(REPORTS);

export function getReport(type: string): ReportDefinition | undefined {
  return REPORTS[type];
}
