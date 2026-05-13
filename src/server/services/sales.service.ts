/**
 * Service de Vendas (PDV-light).
 *
 * Fluxo:
 *   ABERTA ──(addItem/addPayment, edit)──▶ ABERTA
 *          ──concludeSale──▶ CONCLUIDA  (gera SAIDA no estoque por explosão de fichas)
 *          ──cancelSale──▶ CANCELADA   (sem efeito estoque, era ABERTA)
 *   CONCLUIDA ──cancelSale──▶ CANCELADA (reverte com AJUSTE positivo)
 *
 * Snapshots: cada SaleItem grava unitPrice/unitCost no momento da inclusão;
 * reflete custo/preço atual mesmo se o produto for alterado depois.
 *
 * Cascata de estoque (ao CONCLUIR):
 *   item de produto → ficha técnica → ingredientes (qty * recipeItem.qty)
 *   item de combo   → produtos → fichas → ingredientes
 *   produto sem ficha (ou combo sem itens) → não gera SAIDA, mas a venda passa.
 */
import {
  Prisma,
  PaymentMethod,
  SaleProgress,
  SaleSource,
  SaleStatus,
  StockMovementType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { toDecimal, sumDecimal } from "@/lib/decimal";
import { applyEarnForSale } from "./loyalty.service";
import { sendText } from "./whatsapp.service";
import type {
  SaleHeaderFormData,
  SaleItemFormData,
  SaleItemUpdateData,
  SaleListFilters,
  SalePaymentFormData,
} from "@/schemas/sale.schema";

type Tx = Prisma.TransactionClient;

const REFERENCE_TYPE_SALE = "SALE";
const REFERENCE_TYPE_SALE_REVERT = "SALE_CANCEL";

// ---------- Listagem ----------

export async function listSales(filters: SaleListFilters, limit = 100) {
  const where: Prisma.SaleWhereInput = {};
  if (filters.status && filters.status !== "all") where.status = filters.status;
  if (filters.source && filters.source !== "all") where.source = filters.source;
  if (filters.from || filters.to) {
    where.occurredAt = {};
    if (filters.from) (where.occurredAt as Prisma.DateTimeFilter).gte = new Date(filters.from);
    if (filters.to) {
      const to = new Date(filters.to);
      to.setHours(23, 59, 59, 999);
      (where.occurredAt as Prisma.DateTimeFilter).lte = to;
    }
  }
  if (filters.search && filters.search.trim().length > 0) {
    where.OR = [
      { customerName: { contains: filters.search, mode: "insensitive" } },
      { notes: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.sale.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { number: "desc" }],
    take: limit,
    include: {
      _count: { select: { items: true, payments: true } },
    },
  });
}

export async function getSaleById(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          product: { select: { id: true, name: true, salePrice: true, totalCost: true } },
          combo: { select: { id: true, name: true, salePrice: true, totalCost: true } },
        },
      },
      payments: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      cancelledBy: { select: { name: true } },
    },
  });
}

/**
 * Comprovante público da venda — agrega dados pra renderizar a página.
 * Não inclui custos (CMV, totalCost, totalNet) — esses são internos.
 */
export async function getSaleComprovante(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      occurredAt: true,
      closedAt: true,
      customerName: true,
      notes: true,
      totalRevenue: true,
      totalPaid: true,
      totalDiscount: true,
      couponCode: true,
      couponDiscount: true,
      progress: true,
      progressUpdatedAt: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          notes: true,
          product: { select: { name: true } },
          combo: { select: { name: true } },
        },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          method: true,
          amount: true,
          createdAt: true,
        },
      },
      onlinePayment: {
        select: {
          status: true,
          billingType: true,
          paidAt: true,
          asaasPaymentId: true,
        },
      },
      customer: {
        select: {
          name: true,
          phone: true,
          address: true,
          addressNumber: true,
          addressComplement: true,
          neighborhood: true,
          reference: true,
        },
      },
    },
  });
}

// ---------- Helpers internos ----------

function defaultFeePercentForMethod(
  method: PaymentMethod,
  settings: { cardFeePercent: Prisma.Decimal; appFeePercent: Prisma.Decimal },
): number {
  switch (method) {
    case "CARTAO_CREDITO":
    case "CARTAO_DEBITO":
      return Number(settings.cardFeePercent);
    case "APP_IFOOD":
    case "APP_OUTRO":
      return Number(settings.appFeePercent);
    case "DINHEIRO":
    case "PIX":
    case "OUTRO":
    default:
      return 0;
  }
}

async function recomputeSaleTotals(tx: Tx, saleId: string) {
  const [items, payments] = await Promise.all([
    tx.saleItem.findMany({
      where: { saleId },
      select: { totalPrice: true, totalCost: true },
    }),
    tx.salePayment.findMany({
      where: { saleId },
      select: { amount: true, feeAmount: true, netAmount: true },
    }),
  ]);

  const totalRevenue = sumDecimal(items.map((i) => i.totalPrice));
  const totalCost = sumDecimal(items.map((i) => i.totalCost));
  const totalPaid = sumDecimal(payments.map((p) => p.amount));
  const totalFees = sumDecimal(payments.map((p) => p.feeAmount));
  const totalNet = totalPaid.minus(totalFees);
  const diff = totalRevenue.minus(totalPaid);
  const totalDiscount = diff.gt(0) ? diff : toDecimal(0);

  await tx.sale.update({
    where: { id: saleId },
    data: {
      totalRevenue: totalRevenue.toFixed(2),
      totalCost: totalCost.toFixed(4),
      totalPaid: totalPaid.toFixed(2),
      totalFees: totalFees.toFixed(2),
      totalNet: totalNet.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
    },
  });
}

async function ensureEditable(tx: Tx, saleId: string) {
  const sale = await tx.sale.findUnique({ where: { id: saleId }, select: { status: true } });
  if (!sale) throw new BusinessError("Venda não encontrada.");
  if (sale.status !== SaleStatus.ABERTA) {
    throw new BusinessError(
      `Venda ${sale.status.toLowerCase()} não pode ser editada. Cancele e crie uma nova.`,
    );
  }
}

// ---------- Cabeçalho ----------

export async function createSale(input: SaleHeaderFormData, userId: string) {
  return prisma.sale.create({
    data: {
      occurredAt: input.occurredAt ?? new Date(),
      source: input.source,
      customerName: input.customerName,
      notes: input.notes,
      createdById: userId,
    },
  });
}

export async function updateSaleHeader(id: string, input: SaleHeaderFormData) {
  return prisma.$transaction(async (tx) => {
    await ensureEditable(tx, id);
    return tx.sale.update({
      where: { id },
      data: {
        occurredAt: input.occurredAt ?? undefined,
        source: input.source,
        customerName: input.customerName,
        notes: input.notes,
      },
    });
  });
}

// ---------- Items ----------

export async function addSaleItem(saleId: string, input: SaleItemFormData) {
  return prisma.$transaction(async (tx) => {
    await ensureEditable(tx, saleId);

    let unitPriceSnapshot: number;
    let unitCostSnapshot: number;
    if (input.productId) {
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: { id: true, name: true, salePrice: true, totalCost: true, active: true },
      });
      if (!product) throw new BusinessError("Produto não encontrado.");
      if (!product.active) throw new BusinessError(`Produto "${product.name}" está inativo.`);
      unitPriceSnapshot = input.unitPrice ?? Number(product.salePrice ?? 0);
      unitCostSnapshot = Number(product.totalCost);
    } else if (input.comboId) {
      const combo = await tx.combo.findUnique({
        where: { id: input.comboId },
        select: { id: true, name: true, salePrice: true, totalCost: true, active: true },
      });
      if (!combo) throw new BusinessError("Combo não encontrado.");
      if (!combo.active) throw new BusinessError(`Combo "${combo.name}" está inativo.`);
      unitPriceSnapshot = input.unitPrice ?? Number(combo.salePrice ?? 0);
      unitCostSnapshot = Number(combo.totalCost);
    } else {
      throw new BusinessError("Informe produto ou combo.");
    }

    const totalPrice = toDecimal(input.quantity).mul(unitPriceSnapshot);
    const totalCost = toDecimal(input.quantity).mul(unitCostSnapshot);

    const item = await tx.saleItem.create({
      data: {
        saleId,
        productId: input.productId,
        comboId: input.comboId,
        quantity: input.quantity,
        unitPrice: unitPriceSnapshot.toFixed(2),
        unitCost: unitCostSnapshot.toFixed(4),
        totalPrice: totalPrice.toFixed(2),
        totalCost: totalCost.toFixed(4),
        notes: input.notes,
      },
    });

    await recomputeSaleTotals(tx, saleId);
    return item;
  });
}

export async function removeSaleItem(itemId: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.saleItem.findUnique({
      where: { id: itemId },
      select: { saleId: true },
    });
    if (!item) throw new BusinessError("Item de venda não encontrado.");
    await ensureEditable(tx, item.saleId);

    await tx.saleItem.delete({ where: { id: itemId } });
    await recomputeSaleTotals(tx, item.saleId);
  });
}

/**
 * Edita inline um item já existente: quantidade e/ou preço unitário.
 * Mantém o snapshot de unitCost (não precisa re-buscar produto).
 */
export async function updateSaleItem(
  itemId: string,
  input: SaleItemUpdateData,
) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.saleItem.findUnique({
      where: { id: itemId },
      select: { id: true, saleId: true, unitCost: true },
    });
    if (!item) throw new BusinessError("Item de venda não encontrado.");
    await ensureEditable(tx, item.saleId);

    const totalPrice = toDecimal(input.quantity).mul(input.unitPrice);
    const totalCost = toDecimal(input.quantity).mul(toDecimal(item.unitCost));

    await tx.saleItem.update({
      where: { id: itemId },
      data: {
        quantity: input.quantity,
        unitPrice: input.unitPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        totalCost: totalCost.toFixed(4),
      },
    });

    await recomputeSaleTotals(tx, item.saleId);
    return item.saleId;
  });
}

// ---------- Pagamentos ----------

export async function addSalePayment(saleId: string, input: SalePaymentFormData) {
  return prisma.$transaction(async (tx) => {
    await ensureEditable(tx, saleId);

    const settings = await tx.settings.findUnique({
      where: { id: 1 },
      select: { cardFeePercent: true, appFeePercent: true },
    });

    const feePercent =
      input.feePercent ??
      (settings ? defaultFeePercentForMethod(input.method, settings) : 0);
    const amount = toDecimal(input.amount);
    const feeAmount = amount.mul(feePercent);
    const netAmount = amount.minus(feeAmount);

    const payment = await tx.salePayment.create({
      data: {
        saleId,
        method: input.method,
        amount: amount.toFixed(2),
        feePercent: toDecimal(feePercent).toFixed(4),
        feeAmount: feeAmount.toFixed(2),
        netAmount: netAmount.toFixed(2),
        notes: input.notes,
      },
    });

    await recomputeSaleTotals(tx, saleId);
    return payment;
  });
}

export async function removeSalePayment(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.salePayment.findUnique({
      where: { id: paymentId },
      select: { saleId: true },
    });
    if (!payment) throw new BusinessError("Pagamento não encontrado.");
    await ensureEditable(tx, payment.saleId);

    await tx.salePayment.delete({ where: { id: paymentId } });
    await recomputeSaleTotals(tx, payment.saleId);
  });
}

// ---------- Concluir / Cancelar ----------

/**
 * Calcula o consumo de ingredientes ao concluir, explodindo:
 *   - SaleItem(productId) → RecipeItems daquele produto
 *   - SaleItem(comboId)   → ComboItems → Recipes daqueles produtos → RecipeItems
 *
 * Retorna mapa ingredientId → quantidade total a sair.
 */
async function computeIngredientConsumption(
  tx: Tx,
  saleId: string,
): Promise<Map<string, Prisma.Decimal>> {
  const items = await tx.saleItem.findMany({
    where: { saleId },
    select: { quantity: true, productId: true, comboId: true },
  });

  const consumption = new Map<string, Prisma.Decimal>();

  // Coleta produtos a explodir (com suas qtds finais)
  const productQty = new Map<string, Prisma.Decimal>();
  for (const it of items) {
    if (it.productId) {
      const cur = productQty.get(it.productId);
      productQty.set(
        it.productId,
        (cur ? toDecimal(cur) : toDecimal(0)).plus(toDecimal(it.quantity)) as unknown as Prisma.Decimal,
      );
    } else if (it.comboId) {
      // Explode combo em produtos
      const comboItems = await tx.comboItem.findMany({
        where: { comboId: it.comboId },
        select: { productId: true, quantity: true },
      });
      for (const ci of comboItems) {
        const totalQ = toDecimal(it.quantity).mul(toDecimal(ci.quantity));
        const cur = productQty.get(ci.productId);
        productQty.set(
          ci.productId,
          (cur ? toDecimal(cur) : toDecimal(0)).plus(totalQ) as unknown as Prisma.Decimal,
        );
      }
    }
  }

  // Para cada produto acumulado, busca a recipe e explode em ingredientes
  for (const [productId, qty] of productQty.entries()) {
    const recipe = await tx.recipe.findUnique({
      where: { productId },
      select: { id: true },
    });
    if (!recipe) continue; // sem ficha técnica → ignora consumo
    const recipeItems = await tx.recipeItem.findMany({
      where: { recipeId: recipe.id },
      select: { ingredientId: true, quantity: true },
    });
    for (const ri of recipeItems) {
      const ingQty = toDecimal(qty).mul(toDecimal(ri.quantity));
      const cur = consumption.get(ri.ingredientId);
      consumption.set(
        ri.ingredientId,
        (cur ? toDecimal(cur) : toDecimal(0)).plus(ingQty) as unknown as Prisma.Decimal,
      );
    }
  }

  return consumption;
}

export async function concludeSale(saleId: string, userId: string) {
  // Roda a transação primeiro (atômica) e depois dispara o WhatsApp fora —
  // I/O externo nunca dentro de transação, pra não prender locks.
  const { closed, loyalty } = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { _count: { select: { items: true } } },
    });
    if (!sale) throw new BusinessError("Venda não encontrada.");
    if (sale.status !== SaleStatus.ABERTA) {
      throw new BusinessError("Apenas vendas em aberto podem ser concluídas.");
    }
    if (sale._count.items === 0) {
      throw new BusinessError("Adicione ao menos 1 item antes de concluir.");
    }

    const consumption = await computeIngredientConsumption(tx, saleId);
    for (const [ingredientId, qty] of consumption.entries()) {
      const qtyDecimal = toDecimal(qty);
      if (qtyDecimal.lte(0)) continue;
      await tx.stockMovement.create({
        data: {
          ingredientId,
          type: StockMovementType.SAIDA,
          quantity: qtyDecimal.toFixed(4),
          referenceType: REFERENCE_TYPE_SALE,
          referenceId: saleId,
          userId,
        },
      });
    }

    await recomputeSaleTotals(tx, saleId);
    const closedSale = await tx.sale.update({
      where: { id: saleId },
      data: {
        status: SaleStatus.CONCLUIDA,
        closedAt: new Date(),
        closedById: userId,
      },
    });
    // Cartão fidelidade: dispara EARN (e resgate automático se atingir
    // o limiar). Idempotente — se a venda já foi creditada antes,
    // a função detecta e ignora.
    const loyaltyResult = await applyEarnForSale(tx, saleId);
    return { closed: closedSale, loyalty: loyaltyResult };
  });

  // Se gerou cupom de resgate fidelidade e a config ligada, avisa cliente.
  if (loyalty?.redeemedCouponCode && closed.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: closed.customerId },
      select: { name: true, phone: true },
    });
    if (customer?.phone) {
      sendText({
        phone: customer.phone,
        message: `Olá ${customer.name}! 🎉 Você atingiu 100 pontos no cartão fidelidade da Casa Roxa e ganhou um cupom de R$ 10: *${loyalty.redeemedCouponCode}* (válido por 30 dias). É só usar no próximo pedido!`,
        event: "LOYALTY_REDEEM",
        toggleField: "whatsappNotifyLoyaltyRedeem",
        customerId: closed.customerId,
        saleId: closed.id,
      }).catch((e) => console.error("[concludeSale] whatsapp loyalty:", e));
    }
  }

  return closed;
}

export async function cancelSale(
  saleId: string,
  userId: string,
  reason: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new BusinessError("Venda não encontrada.");
    if (sale.status === SaleStatus.CANCELADA) {
      throw new BusinessError("Venda já está cancelada.");
    }

    if (sale.status === SaleStatus.CONCLUIDA) {
      // Reverte movimentos de estoque com AJUSTE positivo
      const saidas = await tx.stockMovement.findMany({
        where: {
          referenceType: REFERENCE_TYPE_SALE,
          referenceId: saleId,
          type: StockMovementType.SAIDA,
        },
        select: { ingredientId: true, quantity: true },
      });
      for (const s of saidas) {
        await tx.stockMovement.create({
          data: {
            ingredientId: s.ingredientId,
            type: StockMovementType.AJUSTE,
            quantity: s.quantity,
            referenceType: REFERENCE_TYPE_SALE_REVERT,
            referenceId: saleId,
            notes: "Reversão automática por cancelamento de venda.",
            userId,
          },
        });
      }
    }

    return tx.sale.update({
      where: { id: saleId },
      data: {
        status: SaleStatus.CANCELADA,
        cancelledAt: new Date(),
        cancelledById: userId,
        cancelReason: reason,
      },
    });
  });
}

// ---------- KPIs (dashboard) ----------

export async function getRevenueLast30Days() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sales = await prisma.sale.findMany({
    where: {
      status: SaleStatus.CONCLUIDA,
      closedAt: { gte: since },
    },
    select: { totalRevenue: true, totalCost: true, totalNet: true },
  });
  const revenue = sumDecimal(sales.map((s) => s.totalRevenue));
  const cost = sumDecimal(sales.map((s) => s.totalCost));
  const net = sumDecimal(sales.map((s) => s.totalNet));
  return {
    revenue: Number(revenue),
    cost: Number(cost),
    net: Number(net),
    count: sales.length,
    cmv: revenue.gt(0) ? cost.div(revenue).toNumber() : null,
  };
}

export async function countOpenSalesOlderThan24h() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.sale.count({
    where: {
      status: SaleStatus.ABERTA,
      createdAt: { lte: cutoff },
    },
  });
}

// ---------- Util pra forms ----------

export async function listActiveProductsForSale() {
  return prisma.product.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      salePrice: true,
      totalCost: true,
    },
  });
}

export async function listActiveCombosForSale() {
  return prisma.combo.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      salePrice: true,
      totalCost: true,
    },
  });
}

export { SaleStatus, SaleSource, PaymentMethod, SaleProgress };

// ---------- Tracking ----------

export type ProgressUpdate = {
  progress: SaleProgress;
  /** Estimativa em minutos (opcional). Null/undefined = não muda. */
  estimateMinutes?: number | null;
};

/**
 * Atualiza progress do pedido (admin). Não muda status (ABERTA/CONCLUIDA),
 * só a etapa visível ao cliente. progressUpdatedAt fica registrado.
 *
 * Dispara notificação WhatsApp pro cliente quando entra em CONFIRMADO,
 * PRONTO ou SAIU_ENTREGA — se a config + toggle do evento estiverem ligados.
 */
export async function setSaleProgress(
  saleId: string,
  input: ProgressUpdate,
) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      number: true,
      customerName: true,
      progress: true,
      customerId: true,
      notes: true,
      customer: { select: { phone: true } },
    },
  });
  if (!sale) throw new BusinessError("Venda não encontrada.");

  const updated = await prisma.sale.update({
    where: { id: saleId },
    data: {
      progress: input.progress,
      progressUpdatedAt: new Date(),
      ...(input.estimateMinutes !== undefined
        ? { progressEstimateMinutes: input.estimateMinutes }
        : {}),
    },
  });

  // Tenta extrair telefone: prioridade pro customer.phone (vínculo direto);
  // se não, parseia a linha "Telefone: ..." das notes (pedidos do site
  // legados antes do Customer existir).
  const phoneFromCustomer = sale.customer?.phone ?? null;
  const phoneFromNotes = sale.notes
    ?.split("\n")
    .find((l) => l.toLowerCase().startsWith("telefone:"))
    ?.replace(/[^0-9]/g, "");
  const phone = phoneFromCustomer ?? phoneFromNotes ?? null;

  if (phone && sale.progress !== input.progress) {
    const tracking = process.env.PUBLIC_DOMAIN
      ? `https://${process.env.PUBLIC_DOMAIN}/pedido/${saleId}`
      : null;
    const customer = sale.customerName ?? "cliente";
    const eta =
      input.estimateMinutes !== undefined && input.estimateMinutes !== null
        ? ` (em até ~${input.estimateMinutes} min)`
        : "";

    let message: string | null = null;
    let toggleField: Parameters<typeof sendText>[0]["toggleField"] = undefined;
    let event: Parameters<typeof sendText>[0]["event"] = "ORDER_CONFIRMED";

    if (input.progress === "CONFIRMADO") {
      event = "ORDER_CONFIRMED";
      toggleField = "whatsappNotifyConfirmed";
      message = `Olá ${customer}! Seu pedido #${sale.number} na Casa Roxa foi *confirmado* ✅${eta}. Acompanhe em ${tracking ?? "(link no site)"}`;
    } else if (input.progress === "PRONTO") {
      event = "ORDER_READY";
      toggleField = "whatsappNotifyReady";
      message = `Pedido #${sale.number} *pronto* 🍗 ${customer}, pode buscar! ${tracking ?? ""}`;
    } else if (input.progress === "SAIU_ENTREGA") {
      event = "ORDER_ON_DELIVERY";
      toggleField = "whatsappNotifyOnDelivery";
      message = `Pedido #${sale.number} *saiu pra entrega* 🛵${eta}. ${customer}, acompanhe em ${tracking ?? "(link no site)"}`;
    }

    if (message && toggleField) {
      // Fire-and-forget. Erros ficam no WhatsAppMessageLog.
      sendText({
        phone,
        message,
        event,
        toggleField,
        customerId: sale.customerId,
        saleId,
      }).catch((e) => console.error("[setSaleProgress] whatsapp:", e));
    }
  }

  return updated;
}

/**
 * Notificações pro admin: pedidos do site (source=SITE) ainda em NOVO.
 * Chamado por polling do bell no header — manter leve.
 */
export async function getNewSiteOrders(limit = 10) {
  return prisma.sale.findMany({
    where: {
      source: SaleSource.SITE,
      progress: SaleProgress.NOVO,
      status: { not: SaleStatus.CANCELADA },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      number: true,
      customerName: true,
      totalRevenue: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
}

/** Versão pública (sem auth) — apenas dados seguros pra exibir ao cliente. */
export async function getPublicSaleTracking(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      number: true,
      occurredAt: true,
      customerName: true,
      status: true,
      progress: true,
      progressUpdatedAt: true,
      progressEstimateMinutes: true,
      totalRevenue: true,
      cancelledAt: true,
      cancelReason: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          product: { select: { name: true } },
          combo: { select: { name: true } },
        },
      },
    },
  });
  if (!sale) return null;
  return sale;
}
