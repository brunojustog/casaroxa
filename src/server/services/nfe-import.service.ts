/**
 * Pipeline de importação de NFe:
 *
 * 1. analyzeNfe(buffer) — parseia o XML, tenta casar fornecedor (CNPJ → nome)
 *    e cada item (similaridade Jaccard com nome do ingrediente).
 *    Retorna preview rico para o cliente decidir.
 *
 * 2. importNfe(payload, userId) — recebe a decisão do usuário (resolve
 *    ingredientes / fornecedor / cria novos se opt-in) e cria:
 *      - Supplier novo (se preciso)
 *      - Ingredient novo (se preciso, para itens com createNew)
 *      - Purchase + PurchaseItems
 *      - Se status=CONFIRMADA: dispara confirmPurchase (gera StockMovements
 *        + cascata de custo).
 *    Tudo numa transação Prisma.
 */
import type { IngredientCategory, IngredientUnit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { applyIngredientPriceChange } from "./recalculation.service";
import { parseNfe, type ParsedNfe, type ParsedNfeItem } from "@/server/importers/nfe-parser";

// ============================================================
// Helpers de matching
// ============================================================

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(" ")
      .filter((t) => t.length >= 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = Array.from(a).filter((t) => b.has(t)).length;
  const union = new Set([...Array.from(a), ...Array.from(b)]).size;
  return union === 0 ? 0 : intersection / union;
}

// uCom (NFe) → IngredientUnit
const UCOM_MAP: Record<string, IngredientUnit> = {
  kg: "KG",
  kgs: "KG",
  quilo: "KG",
  quilos: "KG",
  g: "G",
  gr: "G",
  grama: "G",
  gramas: "G",
  un: "UNIDADE",
  uni: "UNIDADE",
  unid: "UNIDADE",
  unidade: "UNIDADE",
  un1: "UNIDADE",
  pc: "UNIDADE",
  pe: "UNIDADE",
  pct: "PACOTE",
  pacote: "PACOTE",
  l: "LITRO",
  lt: "LITRO",
  litro: "LITRO",
  litros: "LITRO",
  ml: "ML",
  mililitro: "ML",
  cx: "CAIXA",
  caixa: "CAIXA",
};

export function mapUnitFromUCom(uCom: string): IngredientUnit {
  return UCOM_MAP[normalize(uCom)] ?? "UNIDADE";
}

// ============================================================
// Tipos do preview/payload
// ============================================================

export type IngredientSuggestion = {
  ingredientId: string;
  name: string;
  category: IngredientCategory;
  unit: IngredientUnit;
  unitCost: number;
  score: number;
};

export type NfeItemPreview = {
  /** índice na lista (estável para o client). */
  index: number;
  /** dados parseados do XML */
  raw: ParsedNfeItem;
  /** unidade sugerida convertida do uCom */
  suggestedUnit: IngredientUnit;
  /** top 3 sugestões de ingrediente (maior score primeiro). */
  suggestions: IngredientSuggestion[];
  /** sugestão padrão: a melhor com score >= 0.5; senão null. */
  bestMatch: IngredientSuggestion | null;
};

export type NfeSupplierPreview = {
  cnpj: string | null;
  name: string | null;
  matchedSupplierId: string | null;
  /** match foi por CNPJ exato ou só por nome (fuzzy). */
  matchedBy: "cnpj" | "name" | null;
};

export type NfePreview = {
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  totalAmount: number;
  supplier: NfeSupplierPreview;
  items: NfeItemPreview[];
};

// ============================================================
// analyzeNfe — passo 1
// ============================================================

export async function analyzeNfe(buffer: Buffer): Promise<NfePreview> {
  const parsed: ParsedNfe = parseNfe(buffer);

  // ---- Match fornecedor ----
  const supplier: NfeSupplierPreview = {
    cnpj: parsed.supplier.cnpj,
    name: parsed.supplier.name,
    matchedSupplierId: null,
    matchedBy: null,
  };

  if (parsed.supplier.cnpj) {
    const byCnpj = await prisma.supplier.findUnique({
      where: { cnpj: parsed.supplier.cnpj },
      select: { id: true },
    });
    if (byCnpj) {
      supplier.matchedSupplierId = byCnpj.id;
      supplier.matchedBy = "cnpj";
    }
  }
  if (!supplier.matchedSupplierId && parsed.supplier.name) {
    const byName = await prisma.supplier.findFirst({
      where: { name: { equals: parsed.supplier.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (byName) {
      supplier.matchedSupplierId = byName.id;
      supplier.matchedBy = "name";
    }
  }

  // ---- Match itens contra ingredientes ativos ----
  const ingredients = await prisma.ingredient.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      category: true,
      unit: true,
      unitCost: true,
    },
  });
  const ingTokens = ingredients.map((ing) => ({
    ing,
    tokens: tokenize(ing.name),
  }));

  const items: NfeItemPreview[] = parsed.items.map((item, idx) => {
    const itemTokens = tokenize(item.xProd);
    const scored: IngredientSuggestion[] = ingTokens
      .map(({ ing, tokens }) => ({
        ingredientId: ing.id,
        name: ing.name,
        category: ing.category,
        unit: ing.unit,
        unitCost: Number(ing.unitCost),
        score: jaccard(itemTokens, tokens),
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const best = scored[0];
    const bestMatch = best && best.score >= 0.5 ? best : null;

    return {
      index: idx,
      raw: item,
      suggestedUnit: mapUnitFromUCom(item.uCom),
      suggestions: scored,
      bestMatch,
    };
  });

  return {
    invoiceNumber: parsed.invoiceNumber,
    invoiceDate: parsed.invoiceDate,
    totalAmount: parsed.totalAmount,
    supplier,
    items,
  };
}

// ============================================================
// importNfe — passo 2 (executa)
// ============================================================

export type ImportNfeItemDecision =
  | {
      action: "use_existing";
      ingredientId: string;
      quantity: number;
      unitCost: number;
      lotNumber: string | null;
      expiryDate: Date | null;
      updateIngredientCost: boolean;
    }
  | {
      action: "create_new";
      newName: string;
      newCategory: IngredientCategory;
      newUnit: IngredientUnit;
      quantity: number;
      unitCost: number;
      lotNumber: string | null;
      expiryDate: Date | null;
    }
  | { action: "skip" };

export type ImportNfeSupplierDecision =
  | { action: "use_existing"; supplierId: string }
  | { action: "create_new"; name: string; cnpj: string | null }
  | { action: "none" };

export type ImportNfePayload = {
  invoiceNumber: string | null;
  invoiceDate: Date;
  totalAmount: number;
  notes: string | null;
  status: "RASCUNHO" | "CONFIRMADA";
  supplier: ImportNfeSupplierDecision;
  items: ImportNfeItemDecision[];
};

export async function importNfe(payload: ImportNfePayload, userId?: string) {
  // Decisões
  const validItems = payload.items.filter((it) => it.action !== "skip");
  if (validItems.length === 0) {
    throw new BusinessError("Nenhum item selecionado para importar.");
  }

  return prisma.$transaction(async (tx) => {
    // ---------- Resolve supplier ----------
    let supplierId: string | null = null;
    if (payload.supplier.action === "use_existing") {
      const exists = await tx.supplier.findUnique({
        where: { id: payload.supplier.supplierId },
        select: { id: true },
      });
      if (!exists) throw new BusinessError("Fornecedor selecionado não existe.");
      supplierId = exists.id;
    } else if (payload.supplier.action === "create_new") {
      // checa duplicata por nome ou CNPJ
      const dup = await tx.supplier.findFirst({
        where: {
          OR: [
            { name: { equals: payload.supplier.name, mode: "insensitive" } },
            payload.supplier.cnpj
              ? { cnpj: payload.supplier.cnpj }
              : { id: "_never_match_" },
          ],
        },
        select: { id: true },
      });
      if (dup) {
        // já existe — usa
        supplierId = dup.id;
      } else {
        const created = await tx.supplier.create({
          data: {
            name: payload.supplier.name,
            cnpj: payload.supplier.cnpj,
            active: true,
            notes: "Criado via importação de NFe",
          },
        });
        supplierId = created.id;
      }
    }

    // ---------- Cria a Purchase ----------
    const purchase = await tx.purchase.create({
      data: {
        supplierId,
        invoiceNumber: payload.invoiceNumber,
        invoiceDate: payload.invoiceDate,
        notes: payload.notes,
        userId: userId ?? null,
        totalAmount: payload.totalAmount,
        // sempre cria como RASCUNHO; CONFIRMADA aplicada num passo separado abaixo
      },
    });

    // ---------- Resolve cada item ----------
    let calculatedTotal = 0;
    for (const decision of validItems) {
      let ingredientId: string;
      let updateIngredientCost: boolean;

      if (decision.action === "use_existing") {
        const ing = await tx.ingredient.findUnique({
          where: { id: decision.ingredientId },
          select: { id: true, active: true, name: true },
        });
        if (!ing) throw new BusinessError(`Ingrediente inválido: ${decision.ingredientId}`);
        if (!ing.active)
          throw new BusinessError(`Ingrediente "${ing.name}" está inativo.`);
        ingredientId = ing.id;
        updateIngredientCost = decision.updateIngredientCost;
      } else {
        // create_new
        // se já existir um com mesmo nome, reutiliza
        const dup = await tx.ingredient.findUnique({
          where: { name: decision.newName },
          select: { id: true },
        });
        if (dup) {
          ingredientId = dup.id;
        } else {
          const created = await tx.ingredient.create({
            data: {
              name: decision.newName,
              category: decision.newCategory,
              unit: decision.newUnit,
              unitCost: decision.unitCost,
              lastPriceAt: new Date(),
              notes: "Criado via importação de NFe",
              priceHistory: {
                create: {
                  oldPrice: 0,
                  newPrice: decision.unitCost,
                  changedById: userId,
                },
              },
            },
          });
          ingredientId = created.id;
        }
        // Para itens novos, sempre marcamos como atualizar custo (nada a recalcular ainda).
        updateIngredientCost = true;
      }

      const itemTotal = decision.quantity * decision.unitCost;
      calculatedTotal += itemTotal;

      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          ingredientId,
          quantity: decision.quantity,
          unitCost: decision.unitCost,
          totalCost: itemTotal,
          lotNumber: decision.lotNumber,
          expiryDate: decision.expiryDate,
          updateIngredientCost,
        },
      });
    }

    await tx.purchase.update({
      where: { id: purchase.id },
      data: { totalAmount: calculatedTotal },
    });

    // ---------- Confirma se solicitado ----------
    if (payload.status === "CONFIRMADA") {
      const items = await tx.purchaseItem.findMany({
        where: { purchaseId: purchase.id },
      });
      for (const item of items) {
        await tx.stockMovement.create({
          data: {
            ingredientId: item.ingredientId,
            type: "ENTRADA",
            quantity: item.quantity,
            unitCost: item.unitCost,
            lotNumber: item.lotNumber,
            expiryDate: item.expiryDate,
            notes: `NFe ${purchase.invoiceNumber ?? purchase.id.slice(0, 8)}`,
            referenceType: "PURCHASE",
            referenceId: purchase.id,
            userId: userId ?? null,
          },
        });

        if (item.updateIngredientCost) {
          const ing = await tx.ingredient.findUnique({
            where: { id: item.ingredientId },
          });
          if (!ing) continue;
          const oldPrice = Number(ing.unitCost);
          const newPrice = Number(item.unitCost);
          if (oldPrice !== newPrice) {
            await tx.ingredient.update({
              where: { id: item.ingredientId },
              data: { unitCost: item.unitCost, lastPriceAt: new Date() },
            });
            await tx.ingredientPriceHistory.create({
              data: {
                ingredientId: item.ingredientId,
                oldPrice: ing.unitCost,
                newPrice: item.unitCost,
                changedById: userId ?? null,
              },
            });
            await applyIngredientPriceChange(tx, item.ingredientId, newPrice);
          }
        }
      }

      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: "CONFIRMADA",
          confirmedAt: new Date(),
        },
      });
    }

    return { purchaseId: purchase.id, totalAmount: calculatedTotal };
  });
}

// Categoria padrão sugerida quando o item da NF não casa com nada
export const DEFAULT_NEW_INGREDIENT_CATEGORY: IngredientCategory = "OUTRO";
