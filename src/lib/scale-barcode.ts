/**
 * Interpretação dos códigos bipados no PDV (leitor USB):
 *  - Etiqueta da balança Toledo: EAN-13 "2 + corpo(11) + DV". O corpo divide
 *    código/preço em 6+5, 5+6 ou 4+7 dígitos conforme a configuração da
 *    balança — testamos as três divisões e usamos a que casar com um
 *    scaleCode cadastrado. O preço vem em centavos (total da etiqueta).
 *  - Código de fábrica (EAN-8/13): casa com Product.barcode → 1 unidade.
 */

export type ScanCatalogEntry = {
  kind: "PRODUTO" | "COMBO";
  id: string;
  name: string;
  salePrice: number;
  scaleCode?: string | null;
  barcode?: string | null;
};

export type ScanResult =
  | {
      type: "scale";
      entry: ScanCatalogEntry;
      /** Quantidade em kg (3 casas) derivada do preço da etiqueta. */
      quantity: number;
      priceCents: number;
    }
  | { type: "unit"; entry: ScanCatalogEntry }
  | { type: "error"; message: string };

export function parseScannedCode(
  raw: string,
  catalog: ScanCatalogEntry[],
): ScanResult | null {
  const code = raw.replace(/\D/g, "");
  if (!code) return null;

  if (code.length === 13 && code.startsWith("2")) {
    const body = code.slice(1, 12);
    for (const len of [6, 5, 4]) {
      const codeNum = parseInt(body.slice(0, len), 10);
      const entry = catalog.find(
        (c) =>
          c.kind === "PRODUTO" &&
          c.scaleCode &&
          parseInt(c.scaleCode, 10) === codeNum,
      );
      if (entry) {
        const priceCents = parseInt(body.slice(len), 10);
        if (!(entry.salePrice > 0) || !(priceCents > 0)) {
          return {
            type: "error",
            message: `"${entry.name}" sem preço válido pra calcular o peso.`,
          };
        }
        const quantity = Number(
          (priceCents / 100 / entry.salePrice).toFixed(3),
        );
        return { type: "scale", entry, quantity, priceCents };
      }
    }
    return {
      type: "error",
      message: `Nenhum produto com código de balança ${parseInt(body.slice(0, 6), 10)} (nem nas variações do formato).`,
    };
  }

  const entry = catalog.find((c) => c.kind === "PRODUTO" && c.barcode === code);
  if (!entry) {
    return {
      type: "error",
      message: `Código ${code} não cadastrado. Cadastre no produto (campo Código de barras).`,
    };
  }
  return { type: "unit", entry };
}
