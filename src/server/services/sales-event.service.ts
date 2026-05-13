/**
 * Pré-venda / Sales Event (Sprint 2).
 *
 * Como funciona:
 *   - ADMIN cria evento com produtos (limite por produto) + janelas
 *     (slots de retirada/entrega com capacidade).
 *   - Cliente público vê o evento ativo (status=OPEN dentro de
 *     opensAt..closesAt) num banner do cardápio.
 *   - Ao confirmar pedido, o checkout chama reserveSalesEventItems que:
 *       • valida disponibilidade por produto E janela
 *       • incrementa reservedQty (produtos) e reservedCount (janela)
 *       • seta Sale.reservationExpiresAt = now + reservationTimeoutMinutes
 *   - Job de limpeza roda periodicamente e libera reservas expiradas
 *     (Sale ainda ABERTA + reservationExpiresAt < now).
 *
 * Apenas 1 evento OPEN por vez — service garante isso ao abrir.
 */
import { Prisma, SalesEventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import type {
  SalesEventFormData,
  SalesEventListFilters,
} from "@/schemas/sales-event.schema";

// ---------- Listagem / leitura ----------

export async function listSalesEvents(filters: SalesEventListFilters) {
  const where: Prisma.SalesEventWhereInput = {};
  if (filters.status !== "all") where.status = filters.status;

  return prisma.salesEvent.findMany({
    where,
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { sales: true, products: true, windows: true } },
    },
  });
}

export async function getSalesEventById(id: string) {
  return prisma.salesEvent.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { displayOrder: "asc" },
        include: {
          product: { select: { id: true, name: true, salePrice: true } },
          combo: { select: { id: true, name: true, salePrice: true } },
        },
      },
      windows: { orderBy: [{ kind: "asc" }, { startsAt: "asc" }] },
      _count: { select: { sales: true } },
    },
  });
}

/**
 * Retorna o evento ATIVO no momento (status OPEN, dentro da janela
 * opensAt..closesAt). Apenas 1 — pelo design.
 */
export async function getActiveSalesEvent() {
  const now = new Date();
  return prisma.salesEvent.findFirst({
    where: {
      status: "OPEN",
      opensAt: { lte: now },
      closesAt: { gte: now },
    },
    include: {
      products: {
        orderBy: { displayOrder: "asc" },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              salePrice: true,
              imageUrl: true,
              category: true,
              description: true,
            },
          },
          combo: {
            select: {
              id: true,
              name: true,
              salePrice: true,
              imageUrl: true,
              description: true,
            },
          },
        },
      },
      windows: {
        orderBy: [{ kind: "asc" }, { startsAt: "asc" }],
      },
    },
  });
}

// ---------- CRUD admin ----------

export async function createSalesEvent(
  input: SalesEventFormData,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    // Se vai abrir, garante que não há outro OPEN
    if (input.status === "OPEN") {
      await ensureNoOtherActive(tx, null);
    }

    return tx.salesEvent.create({
      data: {
        name: input.name,
        eventDate: input.eventDate,
        description: input.description,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        reservationTimeoutMinutes: input.reservationTimeoutMinutes,
        status: input.status,
        createdById: userId,
        products: {
          create: input.products.map((p) => ({
            productId: p.productId ?? null,
            comboId: p.comboId ?? null,
            quantityLimit: p.quantityLimit,
            unitPriceCents: p.unitPriceCents ?? null,
            displayOrder: p.displayOrder,
          })),
        },
        windows: {
          create: input.windows.map((w) => ({
            kind: w.kind,
            label: w.label,
            startsAt: w.startsAt,
            endsAt: w.endsAt,
            capacity: w.capacity,
            displayOrder: w.displayOrder,
          })),
        },
      },
      include: {
        products: true,
        windows: true,
      },
    });
  });
}

export async function updateSalesEvent(
  id: string,
  input: SalesEventFormData,
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.salesEvent.findUnique({
      where: { id },
      include: { _count: { select: { sales: true } } },
    });
    if (!current) throw new BusinessError("Pré-venda não encontrada.");
    if (current.status === "CANCELLED") {
      throw new BusinessError("Pré-venda cancelada — não pode ser editada.");
    }
    if (current._count.sales > 0) {
      throw new BusinessError(
        "Já há pedidos vinculados. Cancele e crie uma nova pré-venda.",
      );
    }
    if (input.status === "OPEN" && current.status !== "OPEN") {
      await ensureNoOtherActive(tx, id);
    }

    // Recria produtos e janelas (só seguro porque sem pedidos)
    await tx.salesEventProduct.deleteMany({ where: { salesEventId: id } });
    await tx.salesEventWindow.deleteMany({ where: { salesEventId: id } });

    return tx.salesEvent.update({
      where: { id },
      data: {
        name: input.name,
        eventDate: input.eventDate,
        description: input.description,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        reservationTimeoutMinutes: input.reservationTimeoutMinutes,
        status: input.status,
        products: {
          create: input.products.map((p) => ({
            productId: p.productId ?? null,
            comboId: p.comboId ?? null,
            quantityLimit: p.quantityLimit,
            unitPriceCents: p.unitPriceCents ?? null,
            displayOrder: p.displayOrder,
          })),
        },
        windows: {
          create: input.windows.map((w) => ({
            kind: w.kind,
            label: w.label,
            startsAt: w.startsAt,
            endsAt: w.endsAt,
            capacity: w.capacity,
            displayOrder: w.displayOrder,
          })),
        },
      },
      include: { products: true, windows: true },
    });
  });
}

export async function setSalesEventStatus(
  id: string,
  status: SalesEventStatus,
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.salesEvent.findUnique({ where: { id } });
    if (!current) throw new BusinessError("Pré-venda não encontrada.");
    if (status === "OPEN") {
      await ensureNoOtherActive(tx, id);
    }
    return tx.salesEvent.update({ where: { id }, data: { status } });
  });
}

export async function deleteSalesEvent(id: string) {
  const e = await prisma.salesEvent.findUnique({
    where: { id },
    select: { _count: { select: { sales: true } } },
  });
  if (!e) throw new BusinessError("Pré-venda não encontrada.");
  if (e._count.sales > 0) {
    throw new BusinessError(
      "Pré-venda com pedidos não pode ser excluída. Cancele em vez disso.",
    );
  }
  await prisma.salesEvent.delete({ where: { id } });
}

async function ensureNoOtherActive(
  tx: Prisma.TransactionClient,
  excludeId: string | null,
) {
  const where: Prisma.SalesEventWhereInput = { status: "OPEN" };
  if (excludeId) where.id = { not: excludeId };
  const other = await tx.salesEvent.findFirst({ where });
  if (other) {
    throw new BusinessError(
      `Já existe outra pré-venda aberta ("${other.name}"). Encerre ela primeiro.`,
    );
  }
}

// ---------- Reservas (chamado pelo checkout) ----------

/**
 * Reserva itens de um pedido de pré-venda. Chamado dentro da transação
 * que cria a Sale. Valida disponibilidade e incrementa contadores.
 *
 * @returns reservationExpiresAt — Sale.update precisa setar isso.
 */
export async function reserveSalesEventItems(
  tx: Prisma.TransactionClient,
  args: {
    salesEventId: string;
    salesEventWindowId: string;
    items: Array<{ productId?: string | null; comboId?: string | null; quantity: number }>;
  },
): Promise<{ reservationExpiresAt: Date }> {
  const event = await tx.salesEvent.findUnique({
    where: { id: args.salesEventId },
    include: { products: true, windows: true },
  });
  if (!event) throw new BusinessError("Pré-venda não encontrada.");
  if (event.status !== "OPEN") {
    throw new BusinessError("Pré-venda não está aberta pra novos pedidos.");
  }
  const now = new Date();
  if (event.opensAt > now || event.closesAt < now) {
    throw new BusinessError("Pré-venda fora da janela de atendimento.");
  }

  // Valida janela
  const window = event.windows.find((w) => w.id === args.salesEventWindowId);
  if (!window) throw new BusinessError("Janela escolhida inválida.");
  if (window.capacity > 0 && window.reservedCount >= window.capacity) {
    throw new BusinessError(
      `Janela "${window.label}" já está cheia. Escolha outra.`,
    );
  }

  // Valida cada item
  for (const item of args.items) {
    const sep = event.products.find(
      (p) =>
        (item.productId && p.productId === item.productId) ||
        (item.comboId && p.comboId === item.comboId),
    );
    if (!sep) {
      throw new BusinessError(
        "Algum item do carrinho não está disponível nesta pré-venda.",
      );
    }
    if (sep.reservedQty + item.quantity > sep.quantityLimit) {
      const available = sep.quantityLimit - sep.reservedQty;
      throw new BusinessError(
        `Disponibilidade insuficiente: restam ${available} unidade(s).`,
      );
    }
  }

  // Incrementa janela
  await tx.salesEventWindow.update({
    where: { id: window.id },
    data: { reservedCount: { increment: 1 } },
  });
  // Incrementa cada produto
  for (const item of args.items) {
    await tx.salesEventProduct.updateMany({
      where: {
        salesEventId: event.id,
        ...(item.productId
          ? { productId: item.productId }
          : { comboId: item.comboId }),
      },
      data: { reservedQty: { increment: item.quantity } },
    });
  }

  const reservationExpiresAt = new Date(
    now.getTime() + event.reservationTimeoutMinutes * 60 * 1000,
  );
  return { reservationExpiresAt };
}

/**
 * Libera reservas de uma Sale (cancelamento, expiração ou ajuste).
 * Chamado de dentro da transação que altera a Sale.
 */
export async function releaseSalesEventReservation(
  tx: Prisma.TransactionClient,
  saleId: string,
): Promise<void> {
  const sale = await tx.sale.findUnique({
    where: { id: saleId },
    include: {
      items: {
        select: { productId: true, comboId: true, quantity: true },
      },
    },
  });
  if (!sale || !sale.salesEventId) return;

  // Decrementa janela
  if (sale.salesEventWindowId) {
    await tx.salesEventWindow.update({
      where: { id: sale.salesEventWindowId },
      data: { reservedCount: { decrement: 1 } },
    });
  }

  // Decrementa cada produto
  for (const item of sale.items) {
    const qty = Math.round(Number(item.quantity));
    if (qty <= 0) continue;
    await tx.salesEventProduct.updateMany({
      where: {
        salesEventId: sale.salesEventId,
        ...(item.productId
          ? { productId: item.productId }
          : { comboId: item.comboId }),
      },
      data: { reservedQty: { decrement: qty } },
    });
  }

  // Limpa link da Sale (pra não tentar liberar de novo)
  await tx.sale.update({
    where: { id: saleId },
    data: {
      salesEventId: null,
      salesEventWindowId: null,
      reservationExpiresAt: null,
    },
  });
}

/**
 * Job de limpeza: encontra Sales com reservationExpiresAt < now ainda
 * ABERTAs e libera as reservas (marca como CANCELADA).
 *
 * Roda via cron. Retorna quantas reservas foram liberadas.
 */
export async function cleanupExpiredReservations(): Promise<number> {
  const now = new Date();
  const stale = await prisma.sale.findMany({
    where: {
      reservationExpiresAt: { lt: now },
      salesEventId: { not: null },
      status: "ABERTA",
    },
    select: { id: true },
  });

  let count = 0;
  for (const { id } of stale) {
    try {
      await prisma.$transaction(async (tx) => {
        await releaseSalesEventReservation(tx, id);
        await tx.sale.update({
          where: { id },
          data: { status: "CANCELADA", cancelReason: "Reserva de pré-venda expirou sem pagamento." },
        });
      });
      count++;
    } catch (e) {
      console.error("[cleanupExpiredReservations] erro em", id, e);
    }
  }
  return count;
}
