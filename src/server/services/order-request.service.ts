/**
 * Encomenda / OrderRequest (Sprint 3).
 *
 * Como funciona:
 *   - Cliente público (em /encomenda) OU admin (em /encomendas/nova) cria
 *     uma OrderRequest com data/hora desejada futura.
 *   - Site valida antecedência mínima = Settings.orderLeadTimeHours.
 *   - Admin aprova (eventualmente pedindo sinal) ou recusa. Aprovação
 *     gera uma Sale (status ABERTA, source=ENCOMENDA-marcada via notes,
 *     SaleSource.OUTRO + notes prefixadas).
 *   - Após aprovada, status flow: APROVADA → EM_PRODUCAO → PRONTA → ENTREGUE.
 *     Pode ser CANCELADA a qualquer momento (reverte a Sale via Sale.status=CANCELADA).
 */
import {
  OrderRequestStatus,
  Prisma,
  SaleSource,
  SaleStatus,
  WhatsAppEvent,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimal, sumDecimal } from "@/lib/decimal";
import { BusinessError } from "@/server/auth-helpers";
import { sendText } from "./whatsapp.service";
import { upsertCustomerFromCheckout } from "./customer.service";
import type {
  AdminOrderRequestData,
  ApproveOrderRequestData,
  PublicOrderRequestData,
  RejectOrderRequestData,
} from "@/schemas/order-request.schema";

// ---------- Listagem / leitura ----------

export async function listOrderRequests(filters: {
  status?: OrderRequestStatus | "all";
}) {
  const where: Prisma.OrderRequestWhereInput = {};
  if (filters.status && filters.status !== "all") where.status = filters.status;
  return prisma.orderRequest.findMany({
    where,
    orderBy: [{ status: "asc" }, { requestedFor: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { items: true } },
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
}

/**
 * Versão pública (sem auth) — retorna apenas campos seguros pra
 * exibição na página de rastreio /encomenda/[id]. Não expõe adminNotes,
 * createdBy, customerId interno, etc.
 */
export async function getPublicOrderRequestTracking(id: string) {
  return prisma.orderRequest.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      customerName: true,
      requestedFor: true,
      deliveryMode: true,
      status: true,
      rejectionReason: true,
      depositRequiredCents: true,
      depositPaidAt: true,
      saleId: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          quantity: true,
          unitPriceSnapshot: true,
          product: { select: { name: true } },
          combo: { select: { name: true } },
        },
      },
      depositPayment: {
        select: {
          invoiceUrl: true,
          status: true,
          pixPayload: true,
          pixQrCodeBase64: true,
        },
      },
    },
  });
}

export async function getOrderRequestById(id: string) {
  return prisma.orderRequest.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, salePrice: true, imageUrl: true } },
          combo: { select: { id: true, name: true, salePrice: true, imageUrl: true } },
        },
      },
      customer: { select: { id: true, name: true, phone: true } },
      sale: { select: { id: true, number: true, status: true, progress: true } },
      approvedBy: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

// ---------- Criação ----------

/**
 * Carrega catálogo dos items e valida disponibilidade (active=true,
 * salePrice > 0). Retorna lista normalizada com snapshot do preço.
 * Compartilhado entre fluxo público e admin.
 */
async function loadValidatedItems(
  items: PublicOrderRequestData["items"],
): Promise<
  Array<{
    productId: string | null;
    comboId: string | null;
    name: string;
    quantity: number;
    unitPriceCents: number;
  }>
> {
  const productIds = items
    .filter((i) => i.productId)
    .map((i) => i.productId as string);
  const comboIds = items
    .filter((i) => i.comboId)
    .map((i) => i.comboId as string);

  const [products, combos] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds }, active: true, salePrice: { gt: 0 } },
          select: { id: true, name: true, salePrice: true },
        })
      : Promise.resolve([]),
    comboIds.length
      ? prisma.combo.findMany({
          where: { id: { in: comboIds }, active: true, salePrice: { gt: 0 } },
          select: { id: true, name: true, salePrice: true },
        })
      : Promise.resolve([]),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const comboMap = new Map(combos.map((c) => [c.id, c]));

  return items.map((it) => {
    if (it.productId) {
      const p = productMap.get(it.productId);
      if (!p) throw new BusinessError("Item indisponível foi removido do cardápio.");
      return {
        productId: it.productId,
        comboId: null,
        name: p.name,
        quantity: it.quantity,
        unitPriceCents: Math.round(Number(p.salePrice ?? 0) * 100),
      };
    }
    if (it.comboId) {
      const c = comboMap.get(it.comboId);
      if (!c) throw new BusinessError("Combo indisponível foi removido do cardápio.");
      return {
        productId: null,
        comboId: it.comboId,
        name: c.name,
        quantity: it.quantity,
        unitPriceCents: Math.round(Number(c.salePrice ?? 0) * 100),
      };
    }
    throw new BusinessError("Item inválido.");
  });
}

export async function createPublicOrderRequest(input: PublicOrderRequestData) {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { orderLeadTimeHours: true },
  });
  const leadHours = settings?.orderLeadTimeHours ?? 48;
  const minDate = new Date(Date.now() + leadHours * 60 * 60 * 1000);
  if (input.requestedFor < minDate) {
    throw new BusinessError(
      `A data desejada precisa ser pelo menos ${leadHours}h adiante.`,
    );
  }

  const items = await loadValidatedItems(input.items);

  const created = await prisma.$transaction(async (tx) => {
    // Upsert do cliente — falha de telefone não bloqueia o pedido
    let customerId: string | null = null;
    try {
      customerId = await upsertCustomerFromCheckout(tx, {
        name: input.customerName,
        phone: input.customerPhone,
        address: input.deliveryMode === "DELIVERY" ? input.address : null,
        addressNumber:
          input.deliveryMode === "DELIVERY" ? input.addressNumber : null,
        addressComplement:
          input.deliveryMode === "DELIVERY" ? input.addressComplement : null,
        neighborhood:
          input.deliveryMode === "DELIVERY" ? input.neighborhood : null,
        reference: input.deliveryMode === "DELIVERY" ? input.reference : null,
      });
    } catch {
      customerId = null;
    }

    return tx.orderRequest.create({
      data: {
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerId,
        requestedFor: input.requestedFor,
        deliveryMode: input.deliveryMode,
        address: input.deliveryMode === "DELIVERY" ? input.address : null,
        addressNumber:
          input.deliveryMode === "DELIVERY" ? input.addressNumber : null,
        addressComplement:
          input.deliveryMode === "DELIVERY" ? input.addressComplement : null,
        neighborhood:
          input.deliveryMode === "DELIVERY" ? input.neighborhood : null,
        reference: input.deliveryMode === "DELIVERY" ? input.reference : null,
        notes: input.notes,
        source: "SITE",
        status: "PENDENTE",
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            comboId: it.comboId,
            quantity: it.quantity,
            unitPriceSnapshot: (it.unitPriceCents / 100).toFixed(2),
          })),
        },
      },
      select: { id: true, number: true },
    });
  });

  // Confirmação automática ao cliente (fire and forget)
  const businessName = await loadBusinessName();
  void notifyCustomer({
    phone: input.customerPhone,
    event: "ORDER_REQUEST_RECEIVED",
    toggleField: "whatsappNotifyOrderRequestReceived",
    message: [
      `*${businessName}*`,
      ``,
      `Olá, ${input.customerName.split(/\s+/)[0]}! 👋`,
      `Recebemos sua encomenda *ER-${created.number}* pra *${fmtDate(input.requestedFor)}*.`,
      ``,
      `Vamos confirmar em breve por aqui. Obrigado!`,
    ].join("\n"),
  });

  return created;
}

export async function createAdminOrderRequest(
  input: AdminOrderRequestData,
  userId: string,
) {
  // Admin pode criar pra qualquer data (sem validação de leadTime)
  const items = await loadValidatedItems(input.items);

  return prisma.$transaction(async (tx) => {
    let customerId: string | null = null;
    try {
      customerId = await upsertCustomerFromCheckout(tx, {
        name: input.customerName,
        phone: input.customerPhone,
        address: input.deliveryMode === "DELIVERY" ? input.address : null,
        addressNumber:
          input.deliveryMode === "DELIVERY" ? input.addressNumber : null,
        addressComplement:
          input.deliveryMode === "DELIVERY" ? input.addressComplement : null,
        neighborhood:
          input.deliveryMode === "DELIVERY" ? input.neighborhood : null,
        reference: input.deliveryMode === "DELIVERY" ? input.reference : null,
      });
    } catch {
      customerId = null;
    }

    return tx.orderRequest.create({
      data: {
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerId,
        requestedFor: input.requestedFor,
        deliveryMode: input.deliveryMode,
        address: input.deliveryMode === "DELIVERY" ? input.address : null,
        addressNumber:
          input.deliveryMode === "DELIVERY" ? input.addressNumber : null,
        addressComplement:
          input.deliveryMode === "DELIVERY" ? input.addressComplement : null,
        neighborhood:
          input.deliveryMode === "DELIVERY" ? input.neighborhood : null,
        reference: input.deliveryMode === "DELIVERY" ? input.reference : null,
        notes: input.notes,
        source: "ADMIN",
        status: "PENDENTE",
        createdById: userId,
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            comboId: it.comboId,
            quantity: it.quantity,
            unitPriceSnapshot: (it.unitPriceCents / 100).toFixed(2),
          })),
        },
      },
      select: { id: true, number: true },
    });
  });
}

// ---------- Aprovação / recusa ----------

/**
 * Aprova uma encomenda: cria Sale ABERTA com SaleItems baseados nos items
 * da OrderRequest, vincula via OrderRequest.saleId, marca status=APROVADA.
 *
 * O sinal (depositRequiredCents) é opcional — admin pode pedir sinal antes
 * de iniciar produção, ou marcar como "pago" depois. Não bloqueia o fluxo.
 */
export async function approveOrderRequest(
  id: string,
  input: ApproveOrderRequestData,
  userId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const req = await tx.orderRequest.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { totalCost: true } },
            combo: { select: { totalCost: true } },
          },
        },
      },
    });
    if (!req) throw new BusinessError("Encomenda não encontrada.");
    if (req.status !== "PENDENTE") {
      throw new BusinessError(
        "Apenas encomendas pendentes podem ser aprovadas.",
      );
    }
    if (req.saleId) {
      throw new BusinessError("Encomenda já tem Sale vinculada.");
    }

    // Notes da Sale com snapshot dos dados do cliente
    const notes = formatSaleNotes(req);

    // Cria Sale ABERTA
    const sale = await tx.sale.create({
      data: {
        source: SaleSource.OUTRO,
        status: SaleStatus.ABERTA,
        customerName: req.customerName,
        customerId: req.customerId,
        notes,
      },
    });

    // Cria SaleItems com snapshots de preço E custo (custo vem do produto/combo atual)
    let totalRevenue = toDecimal(0);
    let totalCost = toDecimal(0);
    for (const item of req.items) {
      const unitCost = Number(
        item.product?.totalCost ?? item.combo?.totalCost ?? 0,
      );
      const unitPrice = Number(item.unitPriceSnapshot);
      const itemRevenue = toDecimal(item.quantity).mul(unitPrice);
      const itemCost = toDecimal(item.quantity).mul(unitCost);
      totalRevenue = totalRevenue.add(itemRevenue);
      totalCost = totalCost.add(itemCost);
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          comboId: item.comboId,
          quantity: item.quantity,
          unitPrice: unitPrice.toFixed(2),
          unitCost: unitCost.toFixed(4),
          totalPrice: itemRevenue.toFixed(2),
          totalCost: itemCost.toFixed(4),
        },
      });
    }
    await tx.sale.update({
      where: { id: sale.id },
      data: {
        totalRevenue: totalRevenue.toFixed(2),
        totalCost: totalCost.toFixed(4),
      },
    });

    const updated = await tx.orderRequest.update({
      where: { id },
      data: {
        status: "APROVADA",
        approvedAt: new Date(),
        approvedById: userId,
        depositRequiredCents: input.depositRequiredCents ?? null,
        adminNotes: input.adminNotes ?? null,
        saleId: sale.id,
      },
      select: {
        id: true,
        saleId: true,
        number: true,
        customerName: true,
        customerPhone: true,
        requestedFor: true,
        depositRequiredCents: true,
      },
    });
    return updated;
  });

  // Se tem sinal configurado, tenta gerar charge Asaas automaticamente.
  // Falha graceful: se cliente não tem CPF ou Asaas falha, segue sem charge
  // e admin combina manual. invoiceUrl entra na mensagem se gerado.
  let invoiceUrl: string | null = null;
  if (result.depositRequiredCents && result.depositRequiredCents > 0) {
    try {
      const { initiateOrderRequestDepositPayment } = await import(
        "./payment.service"
      );
      const payment = await initiateOrderRequestDepositPayment({
        orderRequestId: result.id,
      });
      invoiceUrl = payment.invoiceUrl ?? null;
    } catch (e) {
      console.warn(
        "[approveOrderRequest] charge Asaas pulada:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  // Notifica cliente fora da transação
  const businessName = await loadBusinessName();
  const publicDomain = process.env.PUBLIC_DOMAIN;
  const trackingUrl = publicDomain
    ? `https://${publicDomain}/encomenda/${result.id}`
    : null;
  const depositLine =
    result.depositRequiredCents && result.depositRequiredCents > 0
      ? invoiceUrl
        ? `\n💳 *Sinal:* R$ ${(result.depositRequiredCents / 100).toFixed(2).replace(".", ",")}\nLink pra pagar (PIX): ${invoiceUrl}`
        : trackingUrl
          ? `\n💳 *Sinal:* R$ ${(result.depositRequiredCents / 100).toFixed(2).replace(".", ",")}\nGere o link de pagamento aqui: ${trackingUrl}`
          : `\nSinal combinado: *R$ ${(result.depositRequiredCents / 100).toFixed(2).replace(".", ",")}*.`
      : "";
  void notifyCustomer({
    phone: result.customerPhone,
    event: "ORDER_REQUEST_APPROVED",
    toggleField: "whatsappNotifyOrderRequestApproved",
    message: [
      `*${businessName}*`,
      ``,
      `Boa, ${result.customerName.split(/\s+/)[0]}! ✅`,
      `Sua encomenda *ER-${result.number}* foi *confirmada* pra *${fmtDate(result.requestedFor)}*.${depositLine}`,
      ``,
      `Qualquer dúvida, é só chamar por aqui.`,
    ].join("\n"),
  });

  return { id: result.id, saleId: result.saleId };
}

export async function rejectOrderRequest(
  id: string,
  input: RejectOrderRequestData,
) {
  const req = await prisma.orderRequest.findUnique({ where: { id } });
  if (!req) throw new BusinessError("Encomenda não encontrada.");
  if (req.status !== "PENDENTE") {
    throw new BusinessError("Apenas encomendas pendentes podem ser recusadas.");
  }
  const updated = await prisma.orderRequest.update({
    where: { id },
    data: { status: "RECUSADA", rejectionReason: input.rejectionReason },
    select: {
      id: true,
      number: true,
      customerName: true,
      customerPhone: true,
      requestedFor: true,
    },
  });

  // Avisa cliente
  const businessName = await loadBusinessName();
  void notifyCustomer({
    phone: updated.customerPhone,
    event: "ORDER_REQUEST_REJECTED",
    toggleField: "whatsappNotifyOrderRequestRejected",
    message: [
      `*${businessName}*`,
      ``,
      `Olá, ${updated.customerName.split(/\s+/)[0]}.`,
      `Não conseguimos atender sua encomenda *ER-${updated.number}* pra ${fmtDate(updated.requestedFor)}.`,
      ``,
      `Motivo: ${input.rejectionReason}`,
      ``,
      `Se quiser tentar outra data, é só chamar.`,
    ].join("\n"),
  });

  return { id: updated.id };
}

/** Avança o status do fluxo pós-aprovação. */
export async function setOrderRequestStatus(
  id: string,
  next: OrderRequestStatus,
) {
  const result = await prisma.$transaction(async (tx) => {
    const req = await tx.orderRequest.findUnique({ where: { id } });
    if (!req) throw new BusinessError("Encomenda não encontrada.");

    // Validações simples de transição
    const allowed: Record<OrderRequestStatus, OrderRequestStatus[]> = {
      PENDENTE: ["APROVADA", "RECUSADA", "CANCELADA"],
      APROVADA: ["EM_PRODUCAO", "CANCELADA"],
      EM_PRODUCAO: ["PRONTA", "CANCELADA"],
      PRONTA: ["ENTREGUE", "CANCELADA"],
      ENTREGUE: [],
      RECUSADA: [],
      CANCELADA: [],
    };
    if (!allowed[req.status].includes(next)) {
      throw new BusinessError(
        `Transição ${req.status} → ${next} não permitida.`,
      );
    }

    // Se cancelando após ter Sale vinculada, cancela a Sale também
    if (next === "CANCELADA" && req.saleId) {
      await tx.sale.update({
        where: { id: req.saleId },
        data: {
          status: SaleStatus.CANCELADA,
          cancelledAt: new Date(),
          cancelReason: "Encomenda cancelada",
        },
      });
    }

    // Se ENTREGUE, fecha a Sale (CONCLUIDA)
    if (next === "ENTREGUE" && req.saleId) {
      await tx.sale.update({
        where: { id: req.saleId },
        data: { status: SaleStatus.CONCLUIDA, closedAt: new Date() },
      });
    }

    const updated = await tx.orderRequest.update({
      where: { id },
      data: { status: next },
      select: {
        id: true,
        status: true,
        number: true,
        customerName: true,
        customerPhone: true,
        deliveryMode: true,
      },
    });
    return updated;
  });

  // Notifica cliente só quando PRONTA (entrega vai ser feita logo após — não duplica)
  if (result.status === "PRONTA") {
    const businessName = await loadBusinessName();
    const pickupOrDelivery =
      result.deliveryMode === "PICKUP"
        ? "Pode vir buscar! 🛍"
        : "Estamos saindo pra entrega! 🛵";
    void notifyCustomer({
      phone: result.customerPhone,
      event: "ORDER_REQUEST_READY",
      toggleField: "whatsappNotifyOrderRequestReady",
      message: [
        `*${businessName}*`,
        ``,
        `Sua encomenda *ER-${result.number}* está *pronta*, ${result.customerName.split(/\s+/)[0]}!`,
        pickupOrDelivery,
      ].join("\n"),
    });
  }

  return { id: result.id, status: result.status };
}

/** Marca o sinal como pago. Útil quando admin confirma recebimento manual. */
export async function markDepositPaid(id: string) {
  const req = await prisma.orderRequest.findUnique({ where: { id } });
  if (!req) throw new BusinessError("Encomenda não encontrada.");
  if (!req.depositRequiredCents || req.depositRequiredCents <= 0) {
    throw new BusinessError("Esta encomenda não tem sinal configurado.");
  }
  return prisma.orderRequest.update({
    where: { id },
    data: { depositPaidAt: new Date() },
    select: { id: true },
  });
}

// ---------- Notificações WhatsApp ----------

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

/** Fire-and-forget: nunca lança, sempre loga em WhatsAppMessageLog. */
async function notifyCustomer(args: {
  phone: string;
  message: string;
  event: WhatsAppEvent;
  toggleField:
    | "whatsappNotifyOrderRequestReceived"
    | "whatsappNotifyOrderRequestApproved"
    | "whatsappNotifyOrderRequestRejected"
    | "whatsappNotifyOrderRequestReady";
}) {
  try {
    await sendText({
      phone: args.phone,
      message: args.message,
      event: args.event,
      toggleField: args.toggleField,
    });
  } catch (e) {
    console.error("[order-request notify]", e);
  }
}

async function loadBusinessName(): Promise<string> {
  const s = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { businessName: true },
  });
  return s?.businessName ?? "Casa Roxa";
}

// ---------- Helpers ----------

function formatSaleNotes(req: {
  customerName: string;
  customerPhone: string;
  deliveryMode: string;
  address: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  reference: string | null;
  notes: string | null;
  requestedFor: Date;
  number: number;
}): string {
  const lines: string[] = [];
  lines.push(`[Encomenda #ER-${req.number}]`);
  lines.push(
    `Pra: ${new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(req.requestedFor)}`,
  );
  lines.push(`Cliente: ${req.customerName}`);
  lines.push(`Telefone: ${req.customerPhone}`);
  lines.push(
    `Modalidade: ${req.deliveryMode === "PICKUP" ? "Retirada no local" : "Delivery"}`,
  );
  if (req.deliveryMode === "DELIVERY") {
    const addr = [
      req.address,
      req.addressNumber ? `nº ${req.addressNumber}` : null,
      req.addressComplement,
    ]
      .filter(Boolean)
      .join(", ");
    if (addr) lines.push(`Endereço: ${addr}`);
    if (req.neighborhood) lines.push(`Bairro: ${req.neighborhood}`);
    if (req.reference) lines.push(`Referência: ${req.reference}`);
  }
  if (req.notes) lines.push(`Observações: ${req.notes}`);
  return lines.join("\n");
}

// Suppress lint complaining sumDecimal unused (might be useful later for analytics)
void sumDecimal;
