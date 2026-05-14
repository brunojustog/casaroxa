/**
 * GET /api/public/reorder/[saleId]
 *
 * Endpoint público (sem auth) que retorna os items de uma Sale anterior
 * pra montar o carrinho de "Pedir novamente". Sem dados sensíveis no
 * payload — só nome/qty/preço atual e flag de disponibilidade.
 *
 * Usa o preço ATUAL (Product.salePrice / Combo.salePrice) — não o snapshot
 * histórico. Items inativos ou tirados do cardápio aparecem em "unavailable"
 * pra UI alertar o cliente antes de adicionar ao carrinho.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ saleId: string }> },
) {
  const { saleId } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      number: true,
      items: {
        select: {
          quantity: true,
          product: {
            select: {
              id: true,
              name: true,
              salePrice: true,
              imageUrl: true,
              active: true,
              showInMenu: true,
            },
          },
          combo: {
            select: {
              id: true,
              name: true,
              salePrice: true,
              imageUrl: true,
              active: true,
              showInMenu: true,
            },
          },
        },
      },
    },
  });

  if (!sale) {
    return NextResponse.json(
      { ok: false, error: "Pedido não encontrado." },
      { status: 404 },
    );
  }

  const available: Array<{
    id: string;
    kind: "PRODUTO" | "COMBO";
    name: string;
    price: number;
    imageUrl: string | null;
    quantity: number;
  }> = [];
  const unavailable: Array<{ name: string; reason: string }> = [];

  for (const it of sale.items) {
    const qty = Math.max(1, Math.round(Number(it.quantity)));
    const ref = it.product ?? it.combo;
    const kind: "PRODUTO" | "COMBO" = it.product ? "PRODUTO" : "COMBO";
    if (!ref) continue;
    const price = Number(ref.salePrice ?? 0);

    if (!ref.active) {
      unavailable.push({ name: ref.name, reason: "Item desativado" });
      continue;
    }
    if (!ref.showInMenu) {
      unavailable.push({
        name: ref.name,
        reason: "Item fora do cardápio agora",
      });
      continue;
    }
    if (price <= 0) {
      unavailable.push({ name: ref.name, reason: "Item sem preço" });
      continue;
    }

    available.push({
      id: ref.id,
      kind,
      name: ref.name,
      price,
      imageUrl: ref.imageUrl,
      quantity: qty,
    });
  }

  return NextResponse.json({
    ok: true,
    saleNumber: sale.number,
    items: available,
    unavailable,
  });
}
