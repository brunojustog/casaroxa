/**
 * Carrinho abandonado (Sprint 7).
 *
 * Capturado quando o cliente preenche telefone válido no checkout E tem
 * items no carrinho. Upsert por customerPhone — um cart "aberto" por
 * número. Cron `/api/cron/recover-abandoned-carts` envia WhatsApp pra
 * carts PENDING há mais de Settings.abandonedCartNotifyAfterMinutes.
 *
 * Quando o cliente volta e finaliza o pedido, public-order.service
 * chama markRecovered pra fechar o ciclo (RECOVERED + saleId).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { sendText } from "./whatsapp.service";
import { normalizePhone } from "@/schemas/customer.schema";

export type CartSnapshotItem = {
  kind: "PRODUTO" | "COMBO";
  id: string;
  name: string;
  price: number;
  quantity: number;
};

// ---------- Captura (público) ----------

export async function upsertAbandonedCart(input: {
  customerPhone: string;
  customerName?: string | null;
  items: CartSnapshotItem[];
}): Promise<{ id: string }> {
  const phone = normalizePhone(input.customerPhone);
  if (!phone || phone.length < 10) {
    throw new BusinessError("Telefone inválido.");
  }
  if (input.items.length === 0) {
    throw new BusinessError("Carrinho vazio.");
  }
  const total = input.items.reduce(
    (acc, it) => acc + it.price * it.quantity,
    0,
  );
  // Match com Customer existente (pra cron escolher destinatário certo)
  const customer = await prisma.customer.findUnique({
    where: { phone },
    select: { id: true, name: true },
  });
  const cart = await prisma.abandonedCart.upsert({
    where: { customerPhone: phone },
    create: {
      customerPhone: phone,
      customerName: input.customerName ?? customer?.name ?? null,
      customerId: customer?.id ?? null,
      itemsSnapshot: input.items as unknown as Prisma.InputJsonValue,
      totalSnapshot: total.toFixed(2),
      status: "PENDING",
    },
    update: {
      // Renova o cart e zera notificação se mudou
      customerName: input.customerName ?? customer?.name ?? null,
      customerId: customer?.id ?? null,
      itemsSnapshot: input.items as unknown as Prisma.InputJsonValue,
      totalSnapshot: total.toFixed(2),
      status: "PENDING",
      notifiedAt: null,
      recoveredSaleId: null,
      recoveredAt: null,
    },
    select: { id: true },
  });
  return cart;
}

// ---------- Recovery (chamado no checkout finalizado) ----------

/** Marca o cart abandonado do cliente como RECOVERED, se houver. */
export async function markRecoveredIfExists(
  tx: Prisma.TransactionClient,
  args: { customerPhone: string; saleId: string },
): Promise<boolean> {
  const phone = normalizePhone(args.customerPhone);
  if (!phone || phone.length < 10) return false;
  const result = await tx.abandonedCart.updateMany({
    where: {
      customerPhone: phone,
      status: { in: ["PENDING", "NOTIFIED"] },
    },
    data: {
      status: "RECOVERED",
      recoveredSaleId: args.saleId,
      recoveredAt: new Date(),
    },
  });
  return result.count > 0;
}

// ---------- Cron: envia WhatsApp de recuperação ----------

export async function notifyAbandonedCarts(): Promise<{
  notified: number;
  errors: number;
}> {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: {
      abandonedCartNotifyAfterMinutes: true,
      businessName: true,
    },
  });
  const minMinutes = settings?.abandonedCartNotifyAfterMinutes ?? 30;
  const cutoff = new Date(Date.now() - minMinutes * 60 * 1000);
  const businessName = settings?.businessName ?? "Casa Roxa";

  const pending = await prisma.abandonedCart.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      notifiedAt: null,
    },
    select: {
      id: true,
      customerPhone: true,
      customerName: true,
      itemsSnapshot: true,
      totalSnapshot: true,
      customerId: true,
    },
    take: 50, // limita lote pra não estourar wuzapi
  });

  let notified = 0;
  let errors = 0;

  for (const cart of pending) {
    const items = cart.itemsSnapshot as unknown as CartSnapshotItem[];
    const itemsText = items
      .map((it) => `• ${it.quantity}× ${it.name}`)
      .join("\n");
    const firstName = cart.customerName?.split(/\s+/)[0] ?? "amigo";
    const total = Number(cart.totalSnapshot).toFixed(2).replace(".", ",");
    const publicDomain = process.env.PUBLIC_DOMAIN;
    const checkoutUrl = publicDomain
      ? `https://${publicDomain}/checkout`
      : "/checkout";

    const message = [
      `Oi, ${firstName}! 👋`,
      ``,
      `Vi que você estava montando um pedido na *${businessName}*:`,
      ``,
      itemsText,
      ``,
      `Total: *R$ ${total}*`,
      ``,
      `Quer finalizar? Vai rapidinho:`,
      checkoutUrl,
    ].join("\n");

    const result = await sendText({
      phone: cart.customerPhone,
      message,
      event: "ABANDONED_CART",
      toggleField: "whatsappNotifyAbandonedCart",
      customerId: cart.customerId,
    });

    await prisma.abandonedCart.update({
      where: { id: cart.id },
      data: {
        status: result.status === "SENT" ? "NOTIFIED" : "PENDING",
        notifiedAt: new Date(),
      },
    });
    if (result.status === "SENT") notified++;
    else if (result.status === "FAILED") errors++;
  }
  return { notified, errors };
}

// ---------- Listagem admin ----------

export async function listAbandonedCarts() {
  return prisma.abandonedCart.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { id: true, name: true } },
    },
  });
}

export async function getAbandonedCartStats(): Promise<{
  pending: number;
  notified: number;
  recovered: number;
  totalRevenue: number;
}> {
  const carts = await prisma.abandonedCart.findMany({
    select: { status: true, totalSnapshot: true, recoveredSaleId: true },
  });
  const pending = carts.filter((c) => c.status === "PENDING").length;
  const notified = carts.filter((c) => c.status === "NOTIFIED").length;
  const recovered = carts.filter((c) => c.status === "RECOVERED");
  const totalRevenue = recovered.reduce(
    (acc, c) => acc + Number(c.totalSnapshot),
    0,
  );
  return {
    pending,
    notified,
    recovered: recovered.length,
    totalRevenue,
  };
}
