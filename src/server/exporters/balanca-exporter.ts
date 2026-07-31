/**
 * Exportador de carga pra balança Toledo (Prix 4/5/6) no layout oficial
 * ITENSMGV.TXT — versão 1 COMPLETA (espec. Toledo "Padrão de cadastro"):
 *
 *   DD(2) T(1) CCCCCC(6) PPPPPP(6) VVV(3) D1(25) D2(25)
 *   RRRRRR(6) FFF(3) IIII(4) DV(1) DE(1) CF(4) L(12) G(11) Z(1) R(2)  + CRLF
 *
 *   DD     departamento (01 fixo — loja única)
 *   T      0 = venda por peso · 1 = venda por unidade
 *   CCCCCC código do item (Product.scaleCode, 6 dígitos)
 *   PPPPPP preço em centavos inteiros (R$ 74,90 → 007490)
 *   VVV    validade em dias (000 = não imprime)
 *   D1/D2  descrição (2 × 25 chars, ASCII sem acento)
 *   DV/DE  IMPRIME data de validade / de embalagem (1/0) — sem esses campos
 *          a importação DESLIGA as datas do item (bug visto em 25/07/2026);
 *          mandamos 1 quando o produto tem scaleValidityDays > 0.
 *   demais associações (info extra, imagem, fornecedor, lote…) = zeros
 *          ("campo preenchido com zeros é ignorado", espec. Toledo)
 *
 * Só entram produtos ativos com scaleCode e salePrice > 0. O tipo (peso vs
 * unidade): portionLabel com "kg" OU ficha 1:1 em KG → peso (fichas em
 * gramas com venda "por kg" contam como peso — ex.: coxinha, bolinha).
 *
 * ATENÇÃO: a etiqueta 40x40 da Prix 4 Flex imprime só ~17 chars do
 * descritivo — Product.scaleName cuida disso.
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
      scaleName: true,
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
    // "por kg" explícito = peso; porção fixa ("1kg pós-assado", "500g",
    // "pacote") = unidade, mesmo com ficha em KG.
    const label = p.portionLabel ?? "";
    const byWeight = /por\s*kg/i.test(label) || (!label && recipeUnit === "KG");
    return {
      scaleCode: p.scaleCode as string,
      // Etiqueta 40x40 imprime só 20 chars — scaleName é o nome curto.
      name: p.scaleName ?? p.name,
      priceCents: Math.round(Number(p.salePrice ?? 0) * 100),
      byWeight,
      validityDays: p.scaleValidityDays ?? 0,
    };
  });
}

/** Gera o conteúdo do ITENSMGV.TXT (linhas de 113 chars + CRLF). */
export function buildItensMgvTxt(items: BalancaItem[]): string {
  const lines = items.map((it) => {
    const d1 = padText(it.name.slice(0, 25), 25);
    const d2 = padText(it.name.length > 25 ? it.name.slice(25, 50) : "", 25);
    // Liga a impressão das datas na balança quando o item tem validade.
    const printDates = it.validityDays > 0 ? "1" : "0";
    return (
      DEPARTMENT +
      (it.byWeight ? "0" : "1") +
      it.scaleCode +
      padNum(it.priceCents, 6) +
      padNum(it.validityDays, 3) +
      d1 +
      d2 +
      "000000" + // RRRRRR — info extra (sem associação)
      "000" + //    FFF — imagem
      "0000" + //   IIII — info nutricional
      printDates + // DV — imprime data de validade
      printDates + // DE — imprime data de embalagem
      "0000" + //   CF — fornecedor
      "000000000000" + // L — lote (12)
      "00000000000" + //  G — reservado (11)
      "0" + //      Z — versão do preço
      "00" //       R — reservado (2)
    );
  });
  // CRLF é obrigatório no padrão Toledo (inclusive na última linha).
  return lines.map((l) => l + "\r\n").join("");
}
