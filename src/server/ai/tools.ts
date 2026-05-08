/**
 * Registry de tools que a IA pode usar.
 *
 * Padrão: read-only por padrão. Tools que mutam dados ficam num módulo separado
 * (próxima fase) e exigem confirmação humana antes de executar.
 *
 * Cada tool define:
 *  - name (snake_case, usado pela API do Claude)
 *  - description (em PT-BR, será incluída no prompt)
 *  - input_schema (JSON Schema)
 *  - run (executor; retorna string ou objeto serializável)
 */
import { prisma } from "@/lib/prisma";
import { calculateCmv, calculateGrossProfit, calculateSuggestedPrice } from "@/domain/calculations";
import { getStockBalance } from "@/server/services/stock.service";
import {
  INGREDIENT_CATEGORY_LABEL,
  INGREDIENT_UNIT_LABEL,
  PRODUCT_CATEGORY_LABEL,
} from "@/lib/enums";

export type ToolHandlerContext = {
  userId?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** true = pode executar sem confirmação humana (read-only). false = exige aprovação. */
  readOnly: boolean;
  run: (input: Record<string, unknown>, ctx: ToolHandlerContext) => Promise<unknown>;
};

// ============================================================
// Read-only tools
// ============================================================

const listIngredientsTool: ToolDefinition = {
  name: "list_ingredients",
  description:
    "Lista ingredientes cadastrados, opcionalmente filtrando por nome ou categoria. Use para responder perguntas como 'qual o preço do frango?' ou 'que ingredientes temos na categoria embalagem?'.",
  readOnly: true,
  input_schema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Busca por nome (case-insensitive). Opcional." },
      category: {
        type: "string",
        enum: ["CARNE", "TEMPERO", "ACOMPANHAMENTO", "EMBALAGEM", "BEBIDA", "LIMPEZA", "GAS", "OUTRO"],
        description: "Filtra por categoria. Opcional.",
      },
      limit: { type: "integer", description: "Máximo de resultados (default 30, máx 100).", default: 30 },
    },
  },
  async run(input) {
    const { search, category, limit = 30 } = input as {
      search?: string;
      category?: string;
      limit?: number;
    };
    const items = await prisma.ingredient.findMany({
      where: {
        active: true,
        ...(category ? { category: category as never } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
      orderBy: { name: "asc" },
      take: Math.min(limit, 100),
      select: {
        id: true,
        name: true,
        category: true,
        unit: true,
        unitCost: true,
        supplier: true,
      },
    });
    return items.map((i) => ({
      id: i.id,
      nome: i.name,
      categoria: INGREDIENT_CATEGORY_LABEL[i.category],
      unidade: INGREDIENT_UNIT_LABEL[i.unit],
      custoUnitario: Number(i.unitCost),
      fornecedor: i.supplier,
    }));
  },
};

const listProductsTool: ToolDefinition = {
  name: "list_products",
  description:
    "Lista produtos vendidos com seus custos, preços e CMV. Use para perguntas sobre lucratividade, CMV, status de produtos, ou quando precisar do ID de um produto pra outra operação.",
  readOnly: true,
  input_schema: {
    type: "object",
    properties: {
      search: { type: "string" },
      category: {
        type: "string",
        enum: ["FRANGO", "COSTELA", "SUINOS", "ACOMPANHAMENTOS", "EXTRAS", "BEBIDAS"],
      },
      limit: { type: "integer", default: 30 },
    },
  },
  async run(input) {
    const { search, category, limit = 30 } = input as {
      search?: string;
      category?: string;
      limit?: number;
    };
    const items = await prisma.product.findMany({
      where: {
        active: true,
        ...(category ? { category: category as never } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
      orderBy: { name: "asc" },
      take: Math.min(limit, 100),
    });
    return items.map((p) => {
      const cost = Number(p.totalCost);
      const price = p.salePrice ? Number(p.salePrice) : 0;
      const cmv = price > 0 && cost > 0 ? Number(calculateCmv(cost, price)) : null;
      const profit = price > 0 ? Number(calculateGrossProfit(cost, price)) : null;
      return {
        id: p.id,
        nome: p.name,
        categoria: PRODUCT_CATEGORY_LABEL[p.category],
        custoTotal: cost,
        precoVenda: price > 0 ? price : null,
        cmv: cmv,
        lucroBruto: profit,
        metaCmv: p.targetCmv ? Number(p.targetCmv) : null,
        status: p.status,
        porcao: p.portionLabel,
      };
    });
  },
};

const listCombosTool: ToolDefinition = {
  name: "list_combos",
  description:
    "Lista combos com custo, preço e CMV calculados. Útil para análises de margem e identificar combos com problema.",
  readOnly: true,
  input_schema: {
    type: "object",
    properties: {
      search: { type: "string" },
      limit: { type: "integer", default: 30 },
    },
  },
  async run(input) {
    const { search, limit = 30 } = input as { search?: string; limit?: number };
    const items = await prisma.combo.findMany({
      where: {
        active: true,
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
      orderBy: { name: "asc" },
      take: Math.min(limit, 100),
      include: { _count: { select: { items: true } } },
    });
    return items.map((c) => {
      const cost = Number(c.totalCost);
      const price = c.salePrice ? Number(c.salePrice) : 0;
      return {
        id: c.id,
        nome: c.name,
        categoria: PRODUCT_CATEGORY_LABEL[c.category],
        nItens: c._count.items,
        custoTotal: cost,
        precoVenda: price > 0 ? price : null,
        cmv: price > 0 && cost > 0 ? Number(calculateCmv(cost, price)) : null,
        lucroBruto: price > 0 ? Number(calculateGrossProfit(cost, price)) : null,
        metaCmv: c.targetCmv ? Number(c.targetCmv) : null,
      };
    });
  },
};

const getStockBalanceTool: ToolDefinition = {
  name: "get_stock_balance",
  description:
    "Retorna o saldo atual em estoque de um ingrediente, dado seu nome ou ID. Use para responder 'quanto tem de X em estoque?'.",
  readOnly: true,
  input_schema: {
    type: "object",
    properties: {
      ingredientId: { type: "string", description: "ID do ingrediente. Use este OU 'name'." },
      name: { type: "string", description: "Nome do ingrediente (busca exata case-insensitive)." },
    },
  },
  async run(input) {
    const { ingredientId, name } = input as { ingredientId?: string; name?: string };
    let id = ingredientId;
    if (!id && name) {
      const ing = await prisma.ingredient.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      id = ing?.id;
    }
    if (!id) return { erro: "Ingrediente não encontrado." };

    const ing = await prisma.ingredient.findUnique({ where: { id } });
    if (!ing) return { erro: "Ingrediente não encontrado." };

    const balance = await getStockBalance(id);
    return {
      ingrediente: ing.name,
      unidade: INGREDIENT_UNIT_LABEL[ing.unit],
      saldoAtual: balance,
      custoUnitario: Number(ing.unitCost),
      valorEmEstoque: balance > 0 ? balance * Number(ing.unitCost) : 0,
    };
  },
};

const calculateSuggestedPriceTool: ToolDefinition = {
  name: "calculate_suggested_price",
  description:
    "Calcula o preço de venda sugerido dado um custo e uma meta de CMV. Útil para responder 'quanto eu deveria cobrar para atingir 50% de CMV?'.",
  readOnly: true,
  input_schema: {
    type: "object",
    properties: {
      cost: { type: "number", description: "Custo total em R$." },
      targetCmvPercent: {
        type: "number",
        description: "Meta de CMV em percent (0-100), ex: 50 para 50%.",
      },
    },
    required: ["cost", "targetCmvPercent"],
  },
  async run(input) {
    const { cost, targetCmvPercent } = input as { cost: number; targetCmvPercent: number };
    const targetFraction = targetCmvPercent / 100;
    const suggested = Number(calculateSuggestedPrice(cost, targetFraction));
    return {
      custo: cost,
      metaCmv: targetFraction,
      precoSugerido: suggested,
      lucroBrutoEsperado: suggested - cost,
    };
  },
};

const listRecentPurchasesTool: ToolDefinition = {
  name: "list_recent_purchases",
  description:
    "Lista as compras (notas fiscais) mais recentes. Use para 'quais foram as últimas compras?' ou 'quanto gastei com fornecedor X?'.",
  readOnly: true,
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "integer", default: 10 },
      status: { type: "string", enum: ["RASCUNHO", "CONFIRMADA", "CANCELADA"] },
    },
  },
  async run(input) {
    const { limit = 10, status } = input as { limit?: number; status?: string };
    const items = await prisma.purchase.findMany({
      where: status ? { status: status as never } : {},
      orderBy: [{ invoiceDate: "desc" }],
      take: Math.min(limit, 50),
      include: {
        supplier: { select: { name: true } },
        _count: { select: { items: true } },
      },
    });
    return items.map((p) => ({
      id: p.id,
      data: p.invoiceDate.toISOString().slice(0, 10),
      numeroNF: p.invoiceNumber,
      fornecedor: p.supplier?.name ?? null,
      total: Number(p.totalAmount),
      status: p.status,
      nItens: p._count.items,
    }));
  },
};

const getDashboardSummaryTool: ToolDefinition = {
  name: "get_dashboard_summary",
  description:
    "Retorna o resumo do dashboard: contagens, CMV médio, alertas ativos. Use quando o usuário pedir 'visão geral', 'como estamos?', 'tem algum problema?'.",
  readOnly: true,
  input_schema: { type: "object", properties: {} },
  async run() {
    const { getDashboardData } = await import("@/server/services/dashboard.service");
    const d = await getDashboardData();
    return {
      contagens: {
        ingredientes: d.counts.ingredients,
        produtos: d.counts.products,
        combos: d.counts.combos,
        movimentosUltimos30Dias: d.counts.stockMovementsLast30Days,
      },
      cmvMedio: {
        produtos: d.avg.productCmv,
        combos: d.avg.comboCmv,
      },
      problemas: d.issues,
      faturamentoAlvoMensal: d.monthlyRevenueTarget,
      alertas: d.alerts.map((a) => ({
        titulo: a.title,
        contagem: a.count,
        severidade: a.severity,
      })),
    };
  },
};

// ============================================================
// Registry
// ============================================================

export const TOOLS: ToolDefinition[] = [
  listIngredientsTool,
  listProductsTool,
  listCombosTool,
  getStockBalanceTool,
  calculateSuggestedPriceTool,
  listRecentPurchasesTool,
  getDashboardSummaryTool,
];

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** Schemas no formato esperado pela API do Claude. */
export function getToolSchemas() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
