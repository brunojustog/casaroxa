/**
 * Service de pedidos vindos do cardápio online (rota pública, sem auth).
 *
 * Cria uma Sale ABERTA com source SITE, items snapshot de produto/combo,
 * e armazena dados do cliente em customerName + notes formatadas
 * (telefone, modalidade, endereço, observações). Pedido entra em /vendas
 * pra Bruno conferir e concluir.
 */
import { SaleSource, SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimal, sumDecimal } from "@/lib/decimal";
import { whatsappLink } from "@/lib/whatsapp";
import { applyCouponInTransaction } from "./coupon.service";
import { upsertCustomerFromCheckout } from "./customer.service";
import { sendPushToAllUsers } from "./push.service";
import { reserveSalesEventItems } from "./sales-event.service";
import type { PublicOrderData } from "@/schemas/public-order.schema";

export type PublicOrderResult = {
  saleId: string;
  saleNumber: number;
  subtotal: number;
  couponDiscount: number;
  total: number;
  couponCode: string | null;
  whatsappLink: string | null;
  trackingUrl: string | null;
};

export async function createPublicOrder(
  input: PublicOrderData,
): Promise<PublicOrderResult> {
  // 1. Carrega catálogo dos itens pedidos (fonte da verdade do preço)
  const productIds = input.items
    .filter((i) => i.kind === "PRODUTO")
    .map((i) => i.id);
  const comboIds = input.items.filter((i) => i.kind === "COMBO").map((i) => i.id);

  const [products, combos, settings] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: {
            id: { in: productIds },
            active: true,
            showInMenu: true,
            salePrice: { gt: 0 },
          },
          select: {
            id: true,
            name: true,
            salePrice: true,
            totalCost: true,
          },
        })
      : Promise.resolve([]),
    comboIds.length
      ? prisma.combo.findMany({
          where: {
            id: { in: comboIds },
            active: true,
            showInMenu: true,
            salePrice: { gt: 0 },
          },
          select: {
            id: true,
            name: true,
            salePrice: true,
            totalCost: true,
          },
        })
      : Promise.resolve([]),
    prisma.settings.findUnique({
      where: { id: 1 },
      select: { whatsappNumber: true, businessName: true, minimumOrderValue: true },
    }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const comboMap = new Map(combos.map((c) => [c.id, c]));

  // 2. Valida que todos os items existem e estão disponíveis
  const validatedItems = input.items.map((it) => {
    const ref = it.kind === "PRODUTO" ? productMap.get(it.id) : comboMap.get(it.id);
    if (!ref) {
      throw new PublicOrderError(
        `Item indisponível foi removido do cardápio. Atualize a página.`,
      );
    }
    return {
      kind: it.kind,
      id: it.id,
      name: ref.name,
      quantity: it.quantity,
      unitPrice: Number(ref.salePrice ?? 0),
      unitCost: Number(ref.totalCost),
    };
  });

  const totals = validatedItems.map((it) => ({
    ...it,
    totalPrice: toDecimal(it.quantity).mul(it.unitPrice),
    totalCost: toDecimal(it.quantity).mul(it.unitCost),
  }));

  const grandTotal = sumDecimal(totals.map((t) => t.totalPrice));

  // 3. Valida pedido mínimo
  const minOrder = settings?.minimumOrderValue ? Number(settings.minimumOrderValue) : 0;
  if (minOrder > 0 && grandTotal.lt(minOrder)) {
    throw new PublicOrderError(
      `Pedido mínimo é R$ ${minOrder.toFixed(2).replace(".", ",")}. Adicione mais itens.`,
    );
  }

  // 4. Monta notes com dados do cliente em texto estruturado
  const notes = formatCustomerNotes(input);

  // 5. Cria a Sale + items numa transação. O cupom (se houver) é validado
  //    e tem o usedCount incrementado dentro da MESMA transação pra não
  //    permitir uso simultâneo acima do limite.
  const subtotalNum = grandTotal.toNumber();
  const sale = await prisma.$transaction(async (tx) => {
    // Upsert do cliente pelo telefone — falha em telefone inválido
    // não impede o pedido (catch + customerId fica null).
    let customerId: string | null = null;
    try {
      customerId = await upsertCustomerFromCheckout(tx, {
        name: input.customerName,
        phone: input.customerPhone,
        address: input.deliveryMode === "DELIVERY" ? input.address : null,
        addressNumber: input.deliveryMode === "DELIVERY" ? input.addressNumber : null,
        addressComplement:
          input.deliveryMode === "DELIVERY" ? input.addressComplement : null,
        neighborhood: input.deliveryMode === "DELIVERY" ? input.neighborhood : null,
        reference: input.deliveryMode === "DELIVERY" ? input.reference : null,
      });
    } catch {
      customerId = null;
    }

    const created = await tx.sale.create({
      data: {
        source: SaleSource.SITE,
        status: SaleStatus.ABERTA,
        customerName: input.customerName,
        customerId,
        notes,
        salesEventId: input.salesEventId ?? null,
        salesEventWindowId: input.salesEventWindowId ?? null,
      },
    });

    for (const t of totals) {
      await tx.saleItem.create({
        data: {
          saleId: created.id,
          productId: t.kind === "PRODUTO" ? t.id : null,
          comboId: t.kind === "COMBO" ? t.id : null,
          quantity: t.quantity,
          unitPrice: t.unitPrice.toFixed(2),
          unitCost: t.unitCost.toFixed(4),
          totalPrice: t.totalPrice.toFixed(2),
          totalCost: t.totalCost.toFixed(4),
        },
      });
    }

    // Reserva da pré-venda (se aplicável). Falha aqui aborta toda a Sale.
    if (input.salesEventId && input.salesEventWindowId) {
      const { reservationExpiresAt } = await reserveSalesEventItems(tx, {
        salesEventId: input.salesEventId,
        salesEventWindowId: input.salesEventWindowId,
        items: validatedItems.map((it) => ({
          productId: it.kind === "PRODUTO" ? it.id : null,
          comboId: it.kind === "COMBO" ? it.id : null,
          quantity: it.quantity,
        })),
      });
      await tx.sale.update({
        where: { id: created.id },
        data: { reservationExpiresAt },
      });
    }

    let couponId: string | null = null;
    let couponCode: string | null = null;
    let couponDiscount = 0;
    if (input.couponCode) {
      try {
        const applied = await applyCouponInTransaction(
          tx,
          input.couponCode,
          subtotalNum,
        );
        couponId = applied.couponId;
        couponCode = applied.couponCode;
        couponDiscount = applied.discount;
      } catch (e) {
        // Re-lança como PublicOrderError pra UI mostrar a mensagem do BusinessError.
        const msg = e instanceof Error ? e.message : "Cupom inválido.";
        throw new PublicOrderError(msg);
      }
    }

    // Atribuição de campanha (Sprint 5): se o cupom usado é de uma
    // campanha, cria CampaignOrderAttribution. Silencioso se não houver.
    if (couponId) {
      const { attributeSaleToCampaign } = await import("./campaign.service");
      await attributeSaleToCampaign(tx, created.id, couponId);
    }

    // Atualiza caches da Sale
    const totalRevenue = sumDecimal(totals.map((t) => t.totalPrice));
    const totalCost = sumDecimal(totals.map((t) => t.totalCost));
    return tx.sale.update({
      where: { id: created.id },
      data: {
        totalRevenue: totalRevenue.toFixed(2),
        totalCost: totalCost.toFixed(4),
        couponId,
        couponCode,
        couponDiscount: couponDiscount.toFixed(2),
        // pagamentos ainda não — Bruno coleta na confirmação
      },
    });
  });

  // 6. URL de rastreamento (visível no checkout/sucesso e na mensagem WhatsApp).
  const publicDomain = process.env.PUBLIC_DOMAIN;
  const trackingUrl = publicDomain
    ? `https://${publicDomain}/pedido/${sale.id}`
    : null;

  // Dispara push notifications pra todos os admins/operadores inscritos.
  // Não bloqueia a resposta — fire and forget; erros são engolidos no service.
  sendPushToAllUsers({
    title: `Novo pedido #${sale.number}`,
    body: `${input.customerName} · ${(grandTotal.toNumber() - Number(sale.couponDiscount)).toFixed(2).replace(".", ",")} — ${input.deliveryMode === "DELIVERY" ? "Delivery" : "Retirada"}`,
    url: `/vendas/${sale.id}`,
    tag: `sale-${sale.id}`,
  }).catch((e) => console.error("[public-order] push falhou:", e));

  const couponDiscount = Number(sale.couponDiscount);
  const subtotal = subtotalNum;
  const finalTotal = Math.max(0, subtotal - couponDiscount);

  // 7. Monta mensagem WhatsApp pré-formatada com o pedido
  const message = buildWhatsappMessage({
    businessName: settings?.businessName ?? "Casa Roxa",
    saleNumber: sale.number,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deliveryMode: input.deliveryMode,
    address: input.address,
    addressNumber: input.addressNumber,
    addressComplement: input.addressComplement,
    neighborhood: input.neighborhood,
    reference: input.reference,
    paymentHint: input.paymentHint,
    extraNotes: input.notes,
    items: totals.map((t) => ({
      name: t.name,
      quantity: t.quantity,
      totalPrice: t.totalPrice.toNumber(),
    })),
    subtotal,
    couponCode: sale.couponCode,
    couponDiscount,
    grandTotal: finalTotal,
    trackingUrl,
  });

  return {
    saleId: sale.id,
    saleNumber: sale.number,
    subtotal,
    couponDiscount,
    total: finalTotal,
    couponCode: sale.couponCode,
    whatsappLink: whatsappLink(settings?.whatsappNumber, message),
    trackingUrl,
  };
}

// ---------- Errors ----------

export class PublicOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicOrderError";
  }
}

// ---------- Helpers ----------

function formatCustomerNotes(input: PublicOrderData): string {
  const lines: string[] = [];
  lines.push(`Cliente: ${input.customerName}`);
  lines.push(`Telefone: ${input.customerPhone}`);
  lines.push(
    `Modalidade: ${input.deliveryMode === "PICKUP" ? "Retirada no local" : "Delivery"}`,
  );
  if (input.deliveryMode === "DELIVERY") {
    const addr = [
      input.address,
      input.addressNumber ? `nº ${input.addressNumber}` : null,
      input.addressComplement,
    ]
      .filter(Boolean)
      .join(", ");
    if (addr) lines.push(`Endereço: ${addr}`);
    if (input.neighborhood) lines.push(`Bairro: ${input.neighborhood}`);
    if (input.reference) lines.push(`Referência: ${input.reference}`);
  }
  if (input.paymentHint) lines.push(`Pagamento sugerido: ${input.paymentHint}`);
  if (input.notes) lines.push(`Observações: ${input.notes}`);
  return lines.join("\n");
}

function buildWhatsappMessage(args: {
  businessName: string;
  saleNumber: number;
  customerName: string;
  customerPhone: string;
  deliveryMode: "PICKUP" | "DELIVERY";
  address: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  reference: string | null;
  paymentHint: string | null;
  extraNotes: string | null;
  items: { name: string; quantity: number; totalPrice: number }[];
  subtotal: number;
  couponCode: string | null;
  couponDiscount: number;
  grandTotal: number;
  trackingUrl: string | null;
}): string {
  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const lines: string[] = [];
  lines.push(`*Olá ${args.businessName}!*`);
  lines.push(`Acabei de fazer um pedido pelo site (#${args.saleNumber}):`);
  lines.push("");
  for (const item of args.items) {
    lines.push(`• ${item.quantity}× ${item.name} — ${fmt(item.totalPrice)}`);
  }
  lines.push("");
  if (args.couponDiscount > 0) {
    lines.push(`Subtotal: ${fmt(args.subtotal)}`);
    lines.push(
      `Cupom ${args.couponCode ?? ""}: −${fmt(args.couponDiscount)}`.trim(),
    );
  }
  lines.push(`*Total: ${fmt(args.grandTotal)}*`);
  lines.push("");
  lines.push(`👤 ${args.customerName}`);
  lines.push(`📱 ${args.customerPhone}`);
  if (args.deliveryMode === "PICKUP") {
    lines.push(`🛍 Retirada no local`);
  } else {
    lines.push(`🛵 Delivery`);
    const addr = [
      args.address,
      args.addressNumber ? `nº ${args.addressNumber}` : null,
      args.addressComplement,
    ]
      .filter(Boolean)
      .join(", ");
    if (addr) lines.push(`📍 ${addr}`);
    if (args.neighborhood) lines.push(`   ${args.neighborhood}`);
    if (args.reference) lines.push(`   Ref: ${args.reference}`);
  }
  if (args.paymentHint) lines.push(`💳 ${args.paymentHint}`);
  if (args.extraNotes) {
    lines.push("");
    lines.push(`📝 ${args.extraNotes}`);
  }
  if (args.trackingUrl) {
    lines.push("");
    lines.push(`🔗 Acompanhar pedido: ${args.trackingUrl}`);
  }
  return lines.join("\n");
}
