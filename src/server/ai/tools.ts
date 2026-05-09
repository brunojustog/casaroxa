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

import type { UserRole } from "@prisma/client";

export type ToolHandlerContext = {
  userId?: string;
  userRole?: UserRole;
};

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** true = read-only. false = mexe em dados (write). */
  readOnly: boolean;
  /**
   * Role mínimo pra usar esta tool. null = qualquer usuário logado.
   * "ADMIN" = só ADMIN. Tools read-only podem deixar null.
   */
  requiresRole?: UserRole | null;
  /**
   * Se true, o assistente DEVE pedir confirmação textual ao usuário
   * antes de chamar (system prompt orienta isso).
   * Não é gate técnico — é orientação ao modelo.
   */
  destructive?: boolean;
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
// Read-only — vendas, cupons e inventários
// ============================================================

const listSalesTool: ToolDefinition = {
  name: "list_sales",
  description:
    "Lista pedidos com nº, cliente, total, status e progresso. Use pra responder 'quais pedidos estão em aberto?', 'quantas vendas hoje?' ou pra encontrar o número de um pedido específico.",
  readOnly: true,
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["ABERTA", "CONCLUIDA", "CANCELADA"],
        description: "Filtra por status. Opcional.",
      },
      progress: {
        type: "string",
        enum: ["NOVO", "CONFIRMADO", "PREPARANDO", "PRONTO", "SAIU_ENTREGA", "ENTREGUE"],
        description: "Filtra por etapa do pedido. Opcional.",
      },
      source: {
        type: "string",
        enum: ["LOJA", "SITE", "WHATSAPP", "DELIVERY"],
        description: "Filtra por origem do pedido. Opcional.",
      },
      sinceDays: {
        type: "integer",
        description: "Apenas pedidos dos últimos N dias. Default 7.",
        default: 7,
      },
      limit: { type: "integer", default: 30 },
    },
  },
  async run(input) {
    const { status, progress, source, sinceDays = 7, limit = 30 } = input as {
      status?: "ABERTA" | "CONCLUIDA" | "CANCELADA";
      progress?: string;
      source?: string;
      sinceDays?: number;
      limit?: number;
    };
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const sales = await prisma.sale.findMany({
      where: {
        occurredAt: { gte: since },
        ...(status ? { status } : {}),
        ...(progress ? { progress: progress as never } : {}),
        ...(source ? { source: source as never } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: Math.min(limit, 100),
      select: {
        id: true,
        number: true,
        occurredAt: true,
        customerName: true,
        source: true,
        status: true,
        progress: true,
        totalRevenue: true,
        couponDiscount: true,
        couponCode: true,
      },
    });
    return sales.map((s) => ({
      id: s.id,
      numero: s.number,
      data: s.occurredAt.toISOString(),
      cliente: s.customerName,
      origem: s.source,
      status: s.status,
      progresso: s.progress,
      totalBruto: Number(s.totalRevenue),
      desconto: Number(s.couponDiscount),
      cupom: s.couponCode,
      totalLiquido: Number(s.totalRevenue) - Number(s.couponDiscount),
    }));
  },
};

const listCouponsTool: ToolDefinition = {
  name: "list_coupons",
  description:
    "Lista cupons cadastrados com código, tipo, valor, usos e validade. Use pra perguntas como 'que cupons estão ativos?', 'quanto o cupom MAIO15 já foi usado?'.",
  readOnly: true,
  input_schema: {
    type: "object",
    properties: {
      active: {
        type: "string",
        enum: ["all", "active", "inactive"],
        default: "all",
      },
      limit: { type: "integer", default: 30 },
    },
  },
  async run(input) {
    const { active = "all", limit = 30 } = input as {
      active?: "all" | "active" | "inactive";
      limit?: number;
    };
    const coupons = await prisma.coupon.findMany({
      where:
        active === "active"
          ? { active: true }
          : active === "inactive"
            ? { active: false }
            : {},
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });
    const now = new Date();
    return coupons.map((c) => ({
      id: c.id,
      codigo: c.code,
      descricao: c.description,
      tipo: c.type,
      valor: Number(c.value),
      usos: c.usedCount,
      limiteUsos: c.maxUses,
      pedidoMinimo: c.minOrderAmount === null ? null : Number(c.minOrderAmount),
      validoAte: c.validUntil?.toISOString() ?? null,
      ativo: c.active,
      expirado: c.validUntil ? c.validUntil < now : false,
      esgotado: c.maxUses !== null && c.usedCount >= c.maxUses,
    }));
  },
};

const listInventoriesTool: ToolDefinition = {
  name: "list_inventories",
  description:
    "Lista sessões de inventário (contagem física) com status, n° de itens e quem abriu. Use pra 'tem alguma contagem aberta?', 'qual foi o último inventário?'.",
  readOnly: true,
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["ABERTA", "FECHADA", "CANCELADA"],
      },
      limit: { type: "integer", default: 10 },
    },
  },
  async run(input) {
    const { status, limit = 10 } = input as {
      status?: "ABERTA" | "FECHADA" | "CANCELADA";
      limit?: number;
    };
    const items = await prisma.inventory.findMany({
      where: status ? { status } : {},
      orderBy: { startedAt: "desc" },
      take: Math.min(limit, 50),
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
    });
    return items.map((i) => ({
      id: i.id,
      nome: i.name,
      status: i.status,
      iniciadoEm: i.startedAt.toISOString(),
      fechadoEm: i.closedAt?.toISOString() ?? null,
      criadoPor: i.createdBy.name,
      itens: i._count.items,
    }));
  },
};

// ============================================================
// Read-only — clientes
// ============================================================

const listCustomersTool: ToolDefinition = {
  name: "list_customers",
  description:
    "Lista clientes cadastrados. Filtre por nome/telefone (search) ou pelo mês de aniversário pra ações de marketing. Use pra responder 'quem faz aniversário em maio?' ou 'quantos clientes temos?'.",
  readOnly: true,
  input_schema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Nome ou telefone parcial." },
      birthdayMonth: {
        type: "integer",
        description: "Mês do aniversário (1-12). Opcional.",
        minimum: 1,
        maximum: 12,
      },
      active: {
        type: "string",
        enum: ["all", "active", "inactive"],
        default: "active",
      },
      limit: { type: "integer", default: 30 },
    },
  },
  async run(input) {
    const { search, birthdayMonth, active = "active", limit = 30 } = input as {
      search?: string;
      birthdayMonth?: number;
      active?: "all" | "active" | "inactive";
      limit?: number;
    };
    const where: Record<string, unknown> = {};
    if (active === "active") where.active = true;
    else if (active === "inactive") where.active = false;
    if (search) {
      const digits = search.replace(/\D+/g, "");
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
      ];
    }
    if (birthdayMonth) {
      const ids = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Customer"
        WHERE birthday IS NOT NULL
        AND EXTRACT(MONTH FROM birthday) = ${birthdayMonth}
      `;
      where.id = { in: ids.map((r) => r.id) };
    }
    const items = await prisma.customer.findMany({
      where: where as never,
      orderBy: { name: "asc" },
      take: Math.min(limit, 100),
      include: { _count: { select: { sales: true } } },
    });
    return items.map((c) => ({
      id: c.id,
      nome: c.name,
      telefone: c.phone,
      bairro: c.neighborhood,
      aniversario: c.birthday?.toISOString().slice(0, 10) ?? null,
      pedidos: c._count.sales,
      ativo: c.active,
    }));
  },
};

const getCustomerTool: ToolDefinition = {
  name: "get_customer",
  description:
    "Detalhes de um cliente + últimos pedidos. Use pra responder 'qual o histórico do João?' ou pra encontrar o ID dele.",
  readOnly: true,
  input_schema: {
    type: "object",
    properties: {
      customerId: { type: "string", description: "ID do cliente." },
      phone: {
        type: "string",
        description: "Telefone do cliente (será normalizado). Use este OU customerId.",
      },
      name: { type: "string", description: "Busca exata por nome (case-insensitive)." },
      saleLimit: { type: "integer", default: 10 },
    },
  },
  async run(input) {
    const { customerId, phone, name, saleLimit = 10 } = input as {
      customerId?: string;
      phone?: string;
      name?: string;
      saleLimit?: number;
    };
    let customer = null;
    if (customerId) {
      customer = await prisma.customer.findUnique({ where: { id: customerId } });
    } else if (phone) {
      const digits = phone.replace(/\D+/g, "");
      customer = await prisma.customer.findUnique({ where: { phone: digits } });
    } else if (name) {
      customer = await prisma.customer.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
    }
    if (!customer) return { erro: "Cliente não encontrado." };

    const sales = await prisma.sale.findMany({
      where: { customerId: customer.id },
      orderBy: { occurredAt: "desc" },
      take: Math.min(saleLimit, 30),
      select: {
        id: true,
        number: true,
        occurredAt: true,
        status: true,
        progress: true,
        totalRevenue: true,
        couponDiscount: true,
        couponCode: true,
        source: true,
      },
    });

    const totalSpent = sales
      .filter((s) => s.status === "CONCLUIDA")
      .reduce(
        (acc, s) => acc + Number(s.totalRevenue) - Number(s.couponDiscount),
        0,
      );

    return {
      id: customer.id,
      nome: customer.name,
      telefone: customer.phone,
      email: customer.email,
      aniversario: customer.birthday?.toISOString().slice(0, 10) ?? null,
      endereco: customer.address,
      bairro: customer.neighborhood,
      ativo: customer.active,
      totalGasto: totalSpent,
      pedidos: sales.map((s) => ({
        numero: s.number,
        data: s.occurredAt.toISOString(),
        status: s.status,
        progresso: s.progress,
        origem: s.source,
        total: Number(s.totalRevenue) - Number(s.couponDiscount),
        cupom: s.couponCode,
      })),
    };
  },
};

// ============================================================
// Registry
// ============================================================

import { WRITE_TOOLS } from "./tools.write";

const READ_TOOLS: ToolDefinition[] = [
  listIngredientsTool,
  listProductsTool,
  listCombosTool,
  getStockBalanceTool,
  calculateSuggestedPriceTool,
  listRecentPurchasesTool,
  getDashboardSummaryTool,
  listSalesTool,
  listCouponsTool,
  listInventoriesTool,
  listCustomersTool,
  getCustomerTool,
];

export const TOOLS: ToolDefinition[] = [...READ_TOOLS, ...WRITE_TOOLS];

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** Schemas no formato esperado pela API do Claude. */
export function getToolSchemas() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
