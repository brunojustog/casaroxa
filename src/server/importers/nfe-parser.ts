/**
 * Parser de NFe (formato SEFAZ Brasil, versão 4.00).
 *
 * Estrutura típica:
 *   <nfeProc> → <NFe> → <infNFe>
 *   <infNFe> → <ide> (ide.nNF, ide.dhEmi)
 *            → <emit> (emit.CNPJ, emit.xNome)
 *            → <det> (lista) → <prod> com cProd, xProd, qCom, vUnCom, etc.
 *
 * Alguns XMLs vêm sem o wrapper <nfeProc> (apenas <NFe>). O parser aceita ambos.
 */
import { XMLParser } from "fast-xml-parser";

export type ParsedNfeItem = {
  nItem: number;
  cProd: string | null;
  xProd: string;
  ncm: string | null;
  cEAN: string | null;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
};

export type ParsedNfe = {
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  supplier: {
    cnpj: string | null;
    name: string | null;
  };
  items: ParsedNfeItem[];
  totalAmount: number;
  raw: { rootKey: string }; // útil pra debug
};

export class NfeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NfeParseError";
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  // Mantém arrays mesmo quando há só um item: <det> sempre array.
  isArray: (name) => ["det"].includes(name),
});

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function asNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function asInt(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

function asDate(v: unknown): Date | null {
  const s = asString(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function findInfNFe(parsed: Record<string, unknown>): {
  infNFe: Record<string, unknown>;
  rootKey: string;
} {
  // Variantes comuns:
  //   nfeProc → NFe → infNFe
  //   NFe → infNFe
  //   procEventoNFe (eventos) — não suportado
  if ("nfeProc" in parsed) {
    const nfeProc = parsed.nfeProc as Record<string, unknown>;
    const nfe = nfeProc.NFe as Record<string, unknown> | undefined;
    if (nfe?.infNFe) return { infNFe: nfe.infNFe as Record<string, unknown>, rootKey: "nfeProc" };
  }
  if ("NFe" in parsed) {
    const nfe = parsed.NFe as Record<string, unknown>;
    if (nfe.infNFe) return { infNFe: nfe.infNFe as Record<string, unknown>, rootKey: "NFe" };
  }
  if ("infNFe" in parsed) {
    return { infNFe: parsed.infNFe as Record<string, unknown>, rootKey: "infNFe" };
  }
  throw new NfeParseError(
    "Estrutura de NFe não reconhecida. Esperado <nfeProc>, <NFe> ou <infNFe> como raiz.",
  );
}

export function parseNfe(xml: string | Buffer): ParsedNfe {
  const text = typeof xml === "string" ? xml : xml.toString("utf-8");
  if (!text.trim().startsWith("<")) {
    throw new NfeParseError("Arquivo não parece ser XML.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(text) as Record<string, unknown>;
  } catch (e) {
    throw new NfeParseError(
      `Erro ao parsear XML: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const { infNFe, rootKey } = findInfNFe(parsed);

  const ide = (infNFe.ide ?? {}) as Record<string, unknown>;
  const emit = (infNFe.emit ?? {}) as Record<string, unknown>;
  const dets = (infNFe.det ?? []) as Array<Record<string, unknown>>;
  const total = (infNFe.total ?? {}) as Record<string, unknown>;
  const icmsTot = (total.ICMSTot ?? {}) as Record<string, unknown>;

  const supplierCnpj = asString(emit.CNPJ) ?? asString(emit.CPF);
  const supplierName = asString(emit.xNome) ?? asString(emit.xFant);

  const invoiceNumber = asString(ide.nNF);
  const invoiceDate = asDate(ide.dhEmi) ?? asDate(ide.dEmi);

  const items: ParsedNfeItem[] = [];
  for (const det of dets) {
    const prod = (det.prod ?? {}) as Record<string, unknown>;
    const xProd = asString(prod.xProd);
    if (!xProd) continue;
    const nItem =
      asInt((det as Record<string, unknown>)["@_nItem"]) || items.length + 1;
    items.push({
      nItem,
      cProd: asString(prod.cProd),
      xProd,
      ncm: asString(prod.NCM),
      cEAN: asString(prod.cEAN),
      uCom: asString(prod.uCom) ?? "UN",
      qCom: asNumber(prod.qCom),
      vUnCom: asNumber(prod.vUnCom),
      vProd: asNumber(prod.vProd),
    });
  }

  if (items.length === 0) {
    throw new NfeParseError(
      "Nenhum item (<det><prod>) encontrado no XML.",
    );
  }

  const totalAmount =
    asNumber(icmsTot.vNF) ||
    items.reduce((acc, it) => acc + it.vProd, 0);

  return {
    invoiceNumber,
    invoiceDate,
    supplier: { cnpj: supplierCnpj, name: supplierName },
    items,
    totalAmount,
    raw: { rootKey },
  };
}
