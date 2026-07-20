/**
 * Exportador de carga pra balança Toledo (Prix 4/5/6) no layout oficial
 * ITENSMGV.TXT — versão 1, retrocompatível com MGV5/MGV6/MGV7:
 *
 *   DD(2) T(1) CCCCCC(6) PPPPPP(6) VVV(3) D1(25) D2(25)  + CRLF
 *
 *   DD     departamento (01 fixo — loja única)
 *   T      0 = venda por peso · 1 = venda por unidade
 *   CCCCCC código do item (Product.scaleCode, 6 dígitos)
 *   PPPPPP preço em centavos inteiros (R$ 74,90 → 007490)
 *   VVV    validade em dias (000 = não imprime)
 *   D1/D2  descrição (2 × 25 chars, ASCII sem acento)
 *
 * Só entram produtos ativos com scaleCode e salePrice > 0. O tipo (peso vs
 * unidade) vem da unidade do ingrediente da ficha 1:1 (KG → peso); fallback
 * pelo portionLabel ("por kg" → peso).
 */
import { prisma } from "@/lib/prisma";

const DEPARTMENT = "01";

/** Remove acentos e não-ASCII — os arquivos da Toledo são ASCII puro. */
function toAscii(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, " ");
}

function padNum(n: number, width: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(width, "0").slice(-width);
}

function padText(s: string, width: number): string {
  return toAscii(s).toUpperCase().padEnd(width, " ").slice(0, width);
}

export type BalancaItem = {
  scaleCode: string;
  name: string;
  priceCents: number;
  byWeight: boolean;
  validityDays: number;
};

export async function loadBalancaItems(): Promise<BalancaItem[]> {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      scaleCode: { not: null },
      salePrice: { gt: 0 },
    },
    orderBy: { scaleCode: "asc" },
    select: {
      scaleCode: true,
      name: true,
      salePrice: true,
      portionLabel: true,
      scaleValidityDays: true,
      recipe: {
        select: {
          items: {
            take: 1,
            select: { unit: true },
          },
        },
      },
    },
  });

  return products.map((p) => {
    const recipeUnit = p.recipe?.items[0]?.unit ?? null;
    const byWeight =
      recipeUnit === "KG" ||
      (recipeUnit === null && (p.portionLabel ?? "").toLowerCase().includes("kg"));
    return {
      scaleCode: p.scaleCode as string,
      name: p.name,
      priceCents: Math.round(Number(p.salePrice ?? 0) * 100),
      byWeight,
      validityDays: p.scaleValidityDays ?? 0,
    };
  });
}

/** Gera o conteúdo do ITENSMGV.TXT (linhas de 68 chars + CRLF). */
export function buildItensMgvTxt(items: BalancaItem[]): string {
  const lines = items.map((it) => {
    const d1 = padText(it.name.slice(0, 25), 25);
    const d2 = padText(it.name.length > 25 ? it.name.slice(25, 50) : "", 25);
    return (
      DEPARTMENT +
      (it.byWeight ? "0" : "1") +
      it.scaleCode +
      padNum(it.priceCents, 6) +
      padNum(it.validityDays, 3) +
      d1 +
      d2
    );
  });
  // CRLF é obrigatório no padrão Toledo (inclusive na última linha).
  return lines.map((l) => l + "\r\n").join("");
}
