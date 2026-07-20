/**
 * GET /api/public/meta-catalog — feed de catálogo pro Meta Commerce Manager.
 *
 * CSV no formato oficial de data feed do Meta (Facebook Shop, Instagram
 * Shopping e anúncios de catálogo Advantage+). O Commerce Manager busca
 * esta URL em agenda (diária/horária) — endpoint público de propósito.
 *
 * Regras:
 *  - Entram produtos e combos ativos, com showInMenu, preço > 0 e FOTO
 *    (o Meta rejeita itens sem image_link).
 *  - `id` = id interno do produto/combo — o MESMO que o Pixel envia em
 *    content_ids (ViewContent/AddToCart), o que liga o catálogo aos
 *    eventos e habilita retargeting dinâmico.
 *  - Sob encomenda → availability "available for order"; demais "in stock".
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SITE = "https://casaroxa.com.br";
const BRAND = "Casa Roxa Assados";

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

function absUrl(pathOrUrl: string): string {
  return pathOrUrl.startsWith("http") ? pathOrUrl : `${SITE}${pathOrUrl}`;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const [products, combos] = await Promise.all([
    prisma.product.findMany({
      where: {
        active: true,
        showInMenu: true,
        salePrice: { gt: 0 },
        imageUrl: { not: null },
      },
      select: {
        id: true,
        name: true,
        description: true,
        ingredientsPublic: true,
        portionLabel: true,
        salePrice: true,
        imageUrl: true,
        status: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.combo.findMany({
      where: {
        active: true,
        showInMenu: true,
        salePrice: { gt: 0 },
        imageUrl: { not: null },
      },
      select: {
        id: true,
        name: true,
        description: true,
        ingredientsPublic: true,
        salePrice: true,
        imageUrl: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const header = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
  ].join(",");

  const rows: string[] = [];

  for (const p of products) {
    const description =
      p.description ??
      p.ingredientsPublic ??
      `${p.name}${p.portionLabel ? ` (${p.portionLabel})` : ""} — ${BRAND}.`;
    rows.push(
      [
        csvCell(p.id),
        csvCell(p.name),
        csvCell(description),
        csvCell(p.status === "SOB_ENCOMENDA" ? "available for order" : "in stock"),
        csvCell("new"),
        csvCell(`${Number(p.salePrice ?? 0).toFixed(2)} BRL`),
        csvCell(`${SITE}/cardapio/produto/${p.id}`),
        csvCell(absUrl(p.imageUrl as string)),
        csvCell(BRAND),
      ].join(","),
    );
  }

  for (const c of combos) {
    const description =
      c.description ?? c.ingredientsPublic ?? `${c.name} — combo da ${BRAND}.`;
    rows.push(
      [
        csvCell(c.id),
        csvCell(c.name),
        csvCell(description),
        csvCell("in stock"),
        csvCell("new"),
        csvCell(`${Number(c.salePrice ?? 0).toFixed(2)} BRL`),
        csvCell(`${SITE}/cardapio/combo/${c.id}`),
        csvCell(absUrl(c.imageUrl as string)),
        csvCell(BRAND),
      ].join(","),
    );
  }

  const csv = [header, ...rows].join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
