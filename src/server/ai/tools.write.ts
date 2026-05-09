/**
 * Tools de escrita pro chat IA.
 *
 * Cada tool aqui MEXE em dados — usa os services com userId pra auditoria.
 * O system prompt orienta o modelo a pedir confirmação textual antes de
 * chamar tools com `destructive: true`. O gate técnico de role acontece
 * no chat.service (ToolHandlerContext.userRole vs ToolDefinition.requiresRole).
 *
 * Convenção de retorno:
 *   { ok: true, ... }            // sucesso, retorna dados úteis pro modelo
 *   { ok: false, erro: "..." }   // falha conhecida (BusinessError), o modelo
 *                                  explica ao usuário em PT-BR
 */
import {
  CouponType,
  IngredientCategory,
  IngredientUnit,
  SaleProgress,
  StockMovementType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";
import { BusinessError } from "@/server/auth-helpers";
import {
  cancelSale as cancelSaleService,
  setSaleProgress,
} from "@/server/services/sales.service";
import { registerStockMovement } from "@/server/services/stock.service";
import {
  setProductActive,
  setProductShowInMenu,
  setProductSalePrice,
} from "@/server/services/product.service";
import {
  setComboActive,
  setComboShowInMenu,
  setComboSalePrice,
} from "@/server/services/combo.service";
import {
  createIngredient as createIngredientService,
  setIngredientActive as setIngredientActiveService,
  updateIngredient as updateIngredientService,
} from "@/server/services/ingredient.service";
import {
  createCoupon as createCouponService,
  setCouponActive as setCouponActiveService,
} from "@/server/services/coupon.service";
import {
  generateBirthdayCoupon as generateBirthdayCouponService,
} from "@/server/services/customer.service";
import {
  sendText as sendWhatsAppText,
} from "@/server/services/whatsapp.service";
import type { ToolDefinition } from "./tools";

// ---------- Helpers de resolução id|nome ----------

async function resolveIngredient(
  args: { ingredientId?: string; name?: string },
): Promise<{ id: string; name: string; unitCost: number } | null> {
  if (args.ingredientId) {
    const i = await prisma.ingredient.findUnique({
      where: { id: args.ingredientId },
      select: { id: true, name: true, unitCost: true },
    });
    return i ? { ...i, unitCost: Number(i.unitCost) } : null;
  }
  if (args.name) {
    const i = await prisma.ingredient.findFirst({
      where: { name: { equals: args.name, mode: "insensitive" } },
      select: { id: true, name: true, unitCost: true },
    });
    return i ? { ...i, unitCost: Number(i.unitCost) } : null;
  }
  return null;
}

async function resolveProduct(args: {
  productId?: string;
  name?: string;
}): Promise<{
  id: string;
  name: string;
  salePrice: number | null;
  active: boolean;
  showInMenu: boolean;
} | null> {
  if (args.productId) {
    const p = await prisma.product.findUnique({ where: { id: args.productId } });
    return p
      ? {
          id: p.id,
          name: p.name,
          salePrice: p.salePrice ? Number(p.salePrice) : null,
          active: p.active,
          showInMenu: p.showInMenu,
        }
      : null;
  }
  if (args.name) {
    const p = await prisma.product.findFirst({
      where: { name: { equals: args.name, mode: "insensitive" } },
    });
    return p
      ? {
          id: p.id,
          name: p.name,
          salePrice: p.salePrice ? Number(p.salePrice) : null,
          active: p.active,
          showInMenu: p.showInMenu,
        }
      : null;
  }
  return null;
}

async function resolveCombo(args: {
  comboId?: string;
  name?: string;
}): Promise<{
  id: string;
  name: string;
  salePrice: number | null;
  active: boolean;
  showInMenu: boolean;
} | null> {
  if (args.comboId) {
    const c = await prisma.combo.findUnique({ where: { id: args.comboId } });
    return c
      ? {
          id: c.id,
          name: c.name,
          salePrice: c.salePrice ? Number(c.salePrice) : null,
          active: c.active,
          showInMenu: c.showInMenu,
        }
      : null;
  }
  if (args.name) {
    const c = await prisma.combo.findFirst({
      where: { name: { equals: args.name, mode: "insensitive" } },
    });
    return c
      ? {
          id: c.id,
          name: c.name,
          salePrice: c.salePrice ? Number(c.salePrice) : null,
          active: c.active,
          showInMenu: c.showInMenu,
        }
      : null;
  }
  return null;
}

async function resolveSale(args: {
  saleId?: string;
  saleNumber?: number;
}): Promise<{
  id: string;
  number: number;
  status: string;
  progress: string;
  total: number;
} | null> {
  let row = null;
  if (args.saleId) {
    row = await prisma.sale.findUnique({ where: { id: args.saleId } });
  } else if (args.saleNumber !== undefined) {
    row = await prisma.sale.findUnique({ where: { number: args.saleNumber } });
  }
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    progress: row.progress,
    total: Number(row.totalRevenue),
  };
}

async function resolveCoupon(args: { couponId?: string; code?: string }) {
  if (args.couponId) {
    return prisma.coupon.findUnique({ where: { id: args.couponId } });
  }
  if (args.code) {
    return prisma.coupon.findUnique({ where: { code: args.code.toUpperCase() } });
  }
  return null;
}

// ============================================================
// VENDAS
// ============================================================

const updateSaleProgressTool: ToolDefinition = {
  name: "update_sale_progress",
  description:
    "Muda o progresso de um pedido (NOVO → CONFIRMADO → PREPARANDO → PRONTO → SAIU_ENTREGA → ENTREGUE). Pode estimar tempo restante em minutos. Use quando o usuário disser coisas como 'marca o pedido 42 como pronto' ou 'pedido 12 saiu pra entrega, 30 min'.",
  readOnly: false,
  destructive: false,
  async run(input, ctx) {
    const { saleId, saleNumber, progress, estimateMinutes } = input as {
      saleId?: string;
      saleNumber?: number;
      progress: SaleProgress;
      estimateMinutes?: number;
    };
    const sale = await resolveSale({ saleId, saleNumber });
    if (!sale) return { ok: false, erro: "Pedido não encontrado." };

    try {
      await setSaleProgress(sale.id, {
        progress,
        estimateMinutes:
          typeof estimateMinutes === "number" ? estimateMinutes : undefined,
      });
      return {
        ok: true,
        pedido: sale.number,
        progressoAnterior: sale.progress,
        progressoNovo: progress,
        estimativaMinutos: estimateMinutes ?? null,
      };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro ao atualizar." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      saleId: { type: "string", description: "ID do pedido (use este OU saleNumber)." },
      saleNumber: { type: "integer", description: "Número visível do pedido (ex.: 42)." },
      progress: {
        type: "string",
        enum: ["NOVO", "CONFIRMADO", "PREPARANDO", "PRONTO", "SAIU_ENTREGA", "ENTREGUE"],
      },
      estimateMinutes: {
        type: "integer",
        description: "Tempo restante estimado em minutos. Opcional.",
        minimum: 0,
        maximum: 240,
      },
    },
    required: ["progress"],
  },
};

const cancelSaleTool: ToolDefinition = {
  name: "cancel_sale",
  description:
    "Cancela um pedido. DESTRUTIVO — se o pedido já estava concluído, gera AJUSTE no estoque pra reverter as saídas. SEMPRE peça confirmação explícita ao usuário antes de chamar.",
  readOnly: false,
  destructive: true,
  async run(input, ctx) {
    const { saleId, saleNumber, reason } = input as {
      saleId?: string;
      saleNumber?: number;
      reason?: string;
    };
    if (!ctx.userId) return { ok: false, erro: "Sessão expirada." };
    const sale = await resolveSale({ saleId, saleNumber });
    if (!sale) return { ok: false, erro: "Pedido não encontrado." };

    try {
      await cancelSaleService(sale.id, ctx.userId, reason ?? null);
      return {
        ok: true,
        pedido: sale.number,
        statusAnterior: sale.status,
        statusNovo: "CANCELADA",
        motivo: reason ?? null,
      };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro ao cancelar." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      saleId: { type: "string" },
      saleNumber: { type: "integer" },
      reason: {
        type: "string",
        description: "Motivo do cancelamento. Recomendado preencher.",
      },
    },
  },
};

// ============================================================
// ESTOQUE
// ============================================================

const registerStockMovementTool: ToolDefinition = {
  name: "register_stock_movement",
  description:
    "Lança um movimento de estoque manual: ENTRADA (chegou produto), SAIDA (consumo manual fora de venda), PERDA (estragou/quebrou) ou AJUSTE (correção positiva). Quantidade SEMPRE positiva — o tipo determina o sinal. PERDA e SAIDA são DESTRUTIVOS — peça confirmação se a quantidade for relevante.",
  readOnly: false,
  destructive: true,
  async run(input, ctx) {
    const { ingredientId, name, type, quantity, unitCost, lotNumber, expiryDate, notes } =
      input as {
        ingredientId?: string;
        name?: string;
        type: StockMovementType;
        quantity: number;
        unitCost?: number;
        lotNumber?: string;
        expiryDate?: string;
        notes?: string;
      };
    const ing = await resolveIngredient({ ingredientId, name });
    if (!ing) return { ok: false, erro: "Ingrediente não encontrado." };
    if (typeof quantity !== "number" || quantity <= 0) {
      return { ok: false, erro: "Quantidade precisa ser maior que zero." };
    }

    try {
      const r = await registerStockMovement(
        {
          ingredientId: ing.id,
          type,
          quantity,
          unitCost: typeof unitCost === "number" ? unitCost : null,
          lotNumber: lotNumber ?? null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          notes: notes ?? null,
        },
        ctx.userId,
      );
      return {
        ok: true,
        ingrediente: ing.name,
        tipo: type,
        quantidade: quantity,
        novoSaldo: r.balance,
      };
    } catch (e) {
      return {
        ok: false,
        erro: e instanceof BusinessError ? e.message : "Erro ao lançar movimento.",
      };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      ingredientId: { type: "string", description: "ID do ingrediente (use este OU name)." },
      name: { type: "string", description: "Nome do ingrediente (busca exata case-insensitive)." },
      type: {
        type: "string",
        enum: ["ENTRADA", "SAIDA", "PERDA", "AJUSTE"],
      },
      quantity: { type: "number", description: "Sempre positivo.", minimum: 0.0001 },
      unitCost: {
        type: "number",
        description: "Custo unitário no momento (opcional, usado em ENTRADA).",
      },
      lotNumber: { type: "string" },
      expiryDate: {
        type: "string",
        description: "ISO date (YYYY-MM-DD). Opcional, só faz sentido em ENTRADA.",
      },
      notes: { type: "string" },
    },
    required: ["type", "quantity"],
  },
};

// ============================================================
// PREÇOS / TOGGLES (ADMIN-only)
// ============================================================

const updateProductPriceTool: ToolDefinition = {
  name: "update_product_price",
  description:
    "Muda o preço de venda de um produto. DESTRUTIVO se a variação for grande (>20%) — peça confirmação nesse caso. Apenas ADMIN.",
  readOnly: false,
  destructive: true,
  requiresRole: "ADMIN",
  async run(input) {
    const { productId, name, salePrice } = input as {
      productId?: string;
      name?: string;
      salePrice: number;
    };
    const p = await resolveProduct({ productId, name });
    if (!p) return { ok: false, erro: "Produto não encontrado." };
    if (typeof salePrice !== "number" || salePrice <= 0) {
      return { ok: false, erro: "Preço precisa ser maior que zero." };
    }

    try {
      await setProductSalePrice(p.id, salePrice);
      return {
        ok: true,
        produto: p.name,
        precoAnterior: p.salePrice,
        precoNovo: salePrice,
      };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro ao atualizar preço." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      productId: { type: "string" },
      name: { type: "string" },
      salePrice: { type: "number", minimum: 0.01 },
    },
    required: ["salePrice"],
  },
};

const setProductShowInMenuTool: ToolDefinition = {
  name: "set_product_show_in_menu",
  description:
    "Liga/desliga visibilidade de um produto no cardápio público. Útil pra esconder algo que acabou sem inativar de vez. ADMIN.",
  readOnly: false,
  requiresRole: "ADMIN",
  async run(input) {
    const { productId, name, show } = input as {
      productId?: string;
      name?: string;
      show: boolean;
    };
    const p = await resolveProduct({ productId, name });
    if (!p) return { ok: false, erro: "Produto não encontrado." };
    try {
      await setProductShowInMenu(p.id, show);
      return { ok: true, produto: p.name, mostrarNoCardapio: show };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      productId: { type: "string" },
      name: { type: "string" },
      show: { type: "boolean" },
    },
    required: ["show"],
  },
};

const setProductActiveTool: ToolDefinition = {
  name: "set_product_active",
  description:
    "Ativa/inativa um produto. DESTRUTIVO ao inativar (some das listagens; pra mostrar de novo precisa reativar). ADMIN.",
  readOnly: false,
  destructive: true,
  requiresRole: "ADMIN",
  async run(input) {
    const { productId, name, active } = input as {
      productId?: string;
      name?: string;
      active: boolean;
    };
    const p = await resolveProduct({ productId, name });
    if (!p) return { ok: false, erro: "Produto não encontrado." };
    try {
      await setProductActive(p.id, active);
      return { ok: true, produto: p.name, ativo: active };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      productId: { type: "string" },
      name: { type: "string" },
      active: { type: "boolean" },
    },
    required: ["active"],
  },
};

const updateComboPriceTool: ToolDefinition = {
  name: "update_combo_price",
  description:
    "Muda o preço de venda de um combo. DESTRUTIVO se a variação for grande (>20%) — peça confirmação nesse caso. Apenas ADMIN.",
  readOnly: false,
  destructive: true,
  requiresRole: "ADMIN",
  async run(input) {
    const { comboId, name, salePrice } = input as {
      comboId?: string;
      name?: string;
      salePrice: number;
    };
    const c = await resolveCombo({ comboId, name });
    if (!c) return { ok: false, erro: "Combo não encontrado." };
    if (typeof salePrice !== "number" || salePrice <= 0) {
      return { ok: false, erro: "Preço precisa ser maior que zero." };
    }
    try {
      await setComboSalePrice(c.id, salePrice);
      return {
        ok: true,
        combo: c.name,
        precoAnterior: c.salePrice,
        precoNovo: salePrice,
      };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro ao atualizar preço." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      comboId: { type: "string" },
      name: { type: "string" },
      salePrice: { type: "number", minimum: 0.01 },
    },
    required: ["salePrice"],
  },
};

const setComboShowInMenuTool: ToolDefinition = {
  name: "set_combo_show_in_menu",
  description: "Liga/desliga combo no cardápio público. ADMIN.",
  readOnly: false,
  requiresRole: "ADMIN",
  async run(input) {
    const { comboId, name, show } = input as {
      comboId?: string;
      name?: string;
      show: boolean;
    };
    const c = await resolveCombo({ comboId, name });
    if (!c) return { ok: false, erro: "Combo não encontrado." };
    try {
      await setComboShowInMenu(c.id, show);
      return { ok: true, combo: c.name, mostrarNoCardapio: show };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      comboId: { type: "string" },
      name: { type: "string" },
      show: { type: "boolean" },
    },
    required: ["show"],
  },
};

const setComboActiveTool: ToolDefinition = {
  name: "set_combo_active",
  description: "Ativa/inativa um combo. DESTRUTIVO ao inativar. ADMIN.",
  readOnly: false,
  destructive: true,
  requiresRole: "ADMIN",
  async run(input) {
    const { comboId, name, active } = input as {
      comboId?: string;
      name?: string;
      active: boolean;
    };
    const c = await resolveCombo({ comboId, name });
    if (!c) return { ok: false, erro: "Combo não encontrado." };
    try {
      await setComboActive(c.id, active);
      return { ok: true, combo: c.name, ativo: active };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      comboId: { type: "string" },
      name: { type: "string" },
      active: { type: "boolean" },
    },
    required: ["active"],
  },
};

// ============================================================
// INGREDIENTES (ADMIN-only)
// ============================================================

const updateIngredientCostTool: ToolDefinition = {
  name: "update_ingredient_cost",
  description:
    "Atualiza o custo unitário de um ingrediente. DESTRUTIVO — dispara cascata: recalcula RecipeItem, Recipe, Product, Combo. Peça confirmação se a variação for >20%. ADMIN.",
  readOnly: false,
  destructive: true,
  requiresRole: "ADMIN",
  async run(input, ctx) {
    const { ingredientId, name, unitCost } = input as {
      ingredientId?: string;
      name?: string;
      unitCost: number;
    };
    const ing = await resolveIngredient({ ingredientId, name });
    if (!ing) return { ok: false, erro: "Ingrediente não encontrado." };
    if (typeof unitCost !== "number" || unitCost < 0) {
      return { ok: false, erro: "Custo inválido." };
    }

    try {
      // Re-busca pra ter os campos restantes no formato do schema.
      const full = await prisma.ingredient.findUnique({ where: { id: ing.id } });
      if (!full) return { ok: false, erro: "Ingrediente não encontrado." };
      await updateIngredientService(
        ing.id,
        {
          name: full.name,
          category: full.category,
          unit: full.unit,
          unitCost,
          packageSize: full.packageSize === null ? null : Number(full.packageSize),
          packagePrice: full.packagePrice === null ? null : Number(full.packagePrice),
          supplier: full.supplier,
          brand: full.brand,
          notes: full.notes,
          active: full.active,
        },
        ctx.userId,
      );
      return {
        ok: true,
        ingrediente: ing.name,
        custoAnterior: ing.unitCost,
        custoNovo: unitCost,
        cascataAplicada: true,
      };
    } catch (e) {
      return {
        ok: false,
        erro: e instanceof BusinessError ? e.message : "Erro ao atualizar custo.",
      };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      ingredientId: { type: "string" },
      name: { type: "string" },
      unitCost: { type: "number", minimum: 0 },
    },
    required: ["unitCost"],
  },
};

const setIngredientActiveTool: ToolDefinition = {
  name: "set_ingredient_active",
  description: "Ativa/inativa um ingrediente. DESTRUTIVO ao inativar. ADMIN.",
  readOnly: false,
  destructive: true,
  requiresRole: "ADMIN",
  async run(input) {
    const { ingredientId, name, active } = input as {
      ingredientId?: string;
      name?: string;
      active: boolean;
    };
    const ing = await resolveIngredient({ ingredientId, name });
    if (!ing) return { ok: false, erro: "Ingrediente não encontrado." };
    try {
      await setIngredientActiveService(ing.id, active);
      return { ok: true, ingrediente: ing.name, ativo: active };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      ingredientId: { type: "string" },
      name: { type: "string" },
      active: { type: "boolean" },
    },
    required: ["active"],
  },
};

const createIngredientTool: ToolDefinition = {
  name: "create_ingredient",
  description:
    "Cadastra um novo ingrediente. ADMIN. Use quando o usuário disser 'cria um ingrediente Y, categoria X, custa R$ Z por kg'.",
  readOnly: false,
  requiresRole: "ADMIN",
  async run(input, ctx) {
    const {
      name,
      category,
      unit,
      unitCost,
      packageSize,
      packagePrice,
      supplier,
      brand,
      notes,
    } = input as {
      name: string;
      category: IngredientCategory;
      unit: IngredientUnit;
      unitCost: number;
      packageSize?: number;
      packagePrice?: number;
      supplier?: string;
      brand?: string;
      notes?: string;
    };
    if (!ctx.userId) return { ok: false, erro: "Sessão expirada." };

    try {
      const ing = await createIngredientService(
        {
          name,
          category,
          unit,
          unitCost,
          packageSize: packageSize ?? null,
          packagePrice: packagePrice ?? null,
          supplier: supplier ?? null,
          brand: brand ?? null,
          notes: notes ?? null,
          active: true,
        },
        ctx.userId,
      );
      return {
        ok: true,
        ingrediente: { id: ing.id, nome: ing.name, custoUnitario: Number(ing.unitCost) },
      };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro ao criar." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      category: {
        type: "string",
        enum: ["CARNE", "TEMPERO", "ACOMPANHAMENTO", "EMBALAGEM", "BEBIDA", "LIMPEZA", "GAS", "OUTRO"],
      },
      unit: {
        type: "string",
        enum: ["KG", "G", "L", "ML", "UN", "DZ", "PCT"],
      },
      unitCost: { type: "number", minimum: 0 },
      packageSize: { type: "number", minimum: 0 },
      packagePrice: { type: "number", minimum: 0 },
      supplier: { type: "string" },
      brand: { type: "string" },
      notes: { type: "string" },
    },
    required: ["name", "category", "unit", "unitCost"],
  },
};

// ============================================================
// CUPONS (ADMIN-only)
// ============================================================

const createCouponTool: ToolDefinition = {
  name: "create_coupon",
  description:
    "Cria um cupom de desconto pra usar no cardápio público. Tipo PERCENT (0-100) ou FIXED (R$). Use quando o usuário disser 'cria cupom MAIO15 15% off pedido mínimo R$ 50'.",
  readOnly: false,
  requiresRole: "ADMIN",
  async run(input) {
    const {
      code,
      description,
      type,
      value,
      maxUses,
      minOrderAmount,
      validUntil,
    } = input as {
      code: string;
      description?: string;
      type: CouponType;
      value: number;
      maxUses?: number;
      minOrderAmount?: number;
      validUntil?: string;
    };

    try {
      const c = await createCouponService({
        code: code.toUpperCase(),
        description: description ?? null,
        type,
        value,
        maxUses: maxUses ?? null,
        minOrderAmount: minOrderAmount ?? null,
        validFrom: null,
        validUntil: validUntil ? new Date(validUntil) : null,
        active: true,
      });
      return {
        ok: true,
        cupom: {
          id: c.id,
          codigo: c.code,
          tipo: c.type,
          valor: Number(c.value),
        },
      };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro ao criar cupom." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      code: { type: "string", description: "Código único, ex.: MAIO15. Será convertido pra MAIÚSCULAS." },
      description: { type: "string" },
      type: { type: "string", enum: ["PERCENT", "FIXED"] },
      value: {
        type: "number",
        description: "PERCENT: 0-100. FIXED: valor em reais.",
        minimum: 0.01,
      },
      maxUses: { type: "integer", description: "Limite total de usos. Vazio = ilimitado.", minimum: 1 },
      minOrderAmount: {
        type: "number",
        description: "Pedido mínimo (subtotal) pra cupom valer.",
        minimum: 0,
      },
      validUntil: {
        type: "string",
        description: "Data limite (YYYY-MM-DD). Opcional.",
      },
    },
    required: ["code", "type", "value"],
  },
};

const setCouponActiveTool: ToolDefinition = {
  name: "set_coupon_active",
  description: "Ativa/inativa um cupom. ADMIN.",
  readOnly: false,
  requiresRole: "ADMIN",
  async run(input) {
    const { couponId, code, active } = input as {
      couponId?: string;
      code?: string;
      active: boolean;
    };
    const c = await resolveCoupon({ couponId, code });
    if (!c) return { ok: false, erro: "Cupom não encontrado." };
    try {
      await setCouponActiveService(c.id, active);
      return { ok: true, cupom: c.code, ativo: active };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      couponId: { type: "string" },
      code: { type: "string" },
      active: { type: "boolean" },
    },
    required: ["active"],
  },
};

const generateBirthdayCouponTool: ToolDefinition = {
  name: "generate_birthday_coupon",
  description:
    "Gera um cupom personalizado de aniversário pra um cliente (15% off por padrão, válido até fim do mês). Idempotente — chama de novo retorna o mesmo código.",
  readOnly: false,
  requiresRole: "ADMIN",
  async run(input) {
    const { customerId, name, percentOff } = input as {
      customerId?: string;
      name?: string;
      percentOff?: number;
    };
    let id = customerId;
    if (!id && name) {
      const c = await prisma.customer.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      id = c?.id;
    }
    if (!id) return { ok: false, erro: "Cliente não encontrado." };

    try {
      const c = await generateBirthdayCouponService(id, {
        percentOff: typeof percentOff === "number" ? percentOff : undefined,
      });
      return {
        ok: true,
        cupom: { codigo: c.code, desconto: `${Number(c.value)}%`, validoAte: c.validUntil },
      };
    } catch (e) {
      return { ok: false, erro: e instanceof BusinessError ? e.message : "Erro ao gerar cupom." };
    }
  },
  input_schema: {
    type: "object",
    properties: {
      customerId: { type: "string" },
      name: { type: "string", description: "Nome do cliente (busca exata case-insensitive)." },
      percentOff: {
        type: "number",
        description: "Desconto em %. Default 15.",
        minimum: 1,
        maximum: 100,
      },
    },
  },
};

// ============================================================
// WHATSAPP
// ============================================================

const sendWhatsAppMessageTool: ToolDefinition = {
  name: "send_whatsapp_message",
  description:
    "Envia uma mensagem de WhatsApp via wuzapi pra um número OU pra um cliente cadastrado. DESTRUTIVO — sempre peça confirmação textual com o conteúdo da mensagem antes de chamar. Use pra contatar cliente fora dos eventos automáticos (ex.: avisar de promoção pontual).",
  readOnly: false,
  destructive: true,
  requiresRole: "ADMIN",
  async run(input) {
    const { phone, customerId, customerName, message } = input as {
      phone?: string;
      customerId?: string;
      customerName?: string;
      message: string;
    };
    if (!message || message.length < 1) {
      return { ok: false, erro: "Mensagem vazia." };
    }

    let resolvedPhone = phone;
    let resolvedCustomerId: string | null = customerId ?? null;
    if (!resolvedPhone) {
      // Resolve via customerId ou nome
      let c = null;
      if (customerId) {
        c = await prisma.customer.findUnique({ where: { id: customerId } });
      } else if (customerName) {
        c = await prisma.customer.findFirst({
          where: { name: { equals: customerName, mode: "insensitive" } },
        });
      }
      if (!c) {
        return {
          ok: false,
          erro: "Forneça phone direto OU customerId/customerName válido.",
        };
      }
      resolvedPhone = c.phone;
      resolvedCustomerId = c.id;
    }

    const r = await sendWhatsAppText({
      phone: resolvedPhone!,
      message,
      event: "MANUAL",
      bypassToggles: true, // chat IA já tá no controle do humano
      customerId: resolvedCustomerId,
    });

    if (r.status === "SENT") {
      return { ok: true, status: "Enviado", logId: r.logId };
    }
    if (r.status === "SKIPPED") {
      return {
        ok: false,
        erro: `Mensagem não enviada: ${r.reason}. Verifique a configuração da API em /configuracoes.`,
      };
    }
    return { ok: false, erro: r.error };
  },
  input_schema: {
    type: "object",
    properties: {
      phone: { type: "string", description: "Telefone com DDI (ex.: 5511999999999). Use isto OU customerId/customerName." },
      customerId: { type: "string" },
      customerName: { type: "string", description: "Busca exata por nome." },
      message: { type: "string", description: "Texto da mensagem. Suporta *negrito*, _itálico_." },
    },
    required: ["message"],
  },
};

// ============================================================
// Registry
// ============================================================

export const WRITE_TOOLS: ToolDefinition[] = [
  updateSaleProgressTool,
  cancelSaleTool,
  registerStockMovementTool,
  updateProductPriceTool,
  setProductShowInMenuTool,
  setProductActiveTool,
  updateComboPriceTool,
  setComboShowInMenuTool,
  setComboActiveTool,
  updateIngredientCostTool,
  setIngredientActiveTool,
  createIngredientTool,
  createCouponTool,
  setCouponActiveTool,
  generateBirthdayCouponTool,
  sendWhatsAppMessageTool,
];

