/**
 * Importador XLSX da Casa Roxa.
 *
 * Abas reconhecidas (case/acento-insensitive):
 *   - "Ingredientes"   → Ingredient
 *   - "Produtos"       → Product
 *   - "Ficha_Tecnica"  → RecipeItem (agrupado por produto)
 *   - "Combos"         → Combo (metadados)
 *   - "Combo_Itens"    → ComboItem
 *   - "Premissas"      → Settings (formato chave/valor)
 *
 * Identifica colunas por aliases case/acento-insensitive (veja FIELD_ALIASES).
 *
 * Modos:
 *   - upsert: insere novos + atualiza existentes (por nome)
 *   - create_only: insere novos, ignora existentes
 *   - update_only: atualiza existentes, ignora novos
 *
 * Sempre roda em transação. Em dry-run, não escreve nada e retorna preview.
 */
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cascadeProductCostToCombos, recalculateRecipeAndCascade } from "@/server/services/recalculation.service";
import type {
  IngredientCategory,
  IngredientUnit,
  ProductCategory,
  ProductStatus,
  ProductType,
} from "@prisma/client";
import type {
  ImportMode,
  ImportPreview,
  ImportResult,
  SheetSummary,
} from "@/schemas/import.schema";

// ============================================================
// HELPERS
// ============================================================

function norm(s: string | undefined | null): string {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findSheetName(workbook: XLSX.WorkBook, aliases: string[]): string | null {
  for (const sheetName of workbook.SheetNames) {
    const n = norm(sheetName);
    for (const alias of aliases) {
      if (n === norm(alias)) return sheetName;
    }
  }
  return null;
}

function readSheet(workbook: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

function pick(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const key of Object.keys(row)) {
    const nk = norm(key);
    for (const alias of aliases) {
      if (nk === norm(alias)) return row[key];
    }
  }
  return null;
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
    const n2 = Number(v);
    return Number.isFinite(n2) ? n2 : null;
  }
  return null;
}

function parseString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function parsePercent(v: unknown): number | null {
  const n = parseNumber(v);
  if (n === null) return null;
  // Aceita 0..1 (já em fração) ou 0..100 (em percent)
  if (n > 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return n / 100;
  return null;
}

// ---------- mapeamento de enums ----------

const INGREDIENT_CATEGORY_MAP: Record<string, IngredientCategory> = {
  carne: "CARNE", carnes: "CARNE",
  tempero: "TEMPERO", temperos: "TEMPERO", condimento: "TEMPERO",
  acompanhamento: "ACOMPANHAMENTO", acompanhamentos: "ACOMPANHAMENTO",
  embalagem: "EMBALAGEM", embalagens: "EMBALAGEM",
  bebida: "BEBIDA", bebidas: "BEBIDA",
  limpeza: "LIMPEZA", epi: "LIMPEZA", epis: "LIMPEZA",
  gas: "GAS", carvao: "GAS",
  outro: "OUTRO", outros: "OUTRO",
};

const INGREDIENT_UNIT_MAP: Record<string, IngredientUnit> = {
  kg: "KG", quilo: "KG", quilos: "KG",
  g: "G", grama: "G", gramas: "G",
  un: "UNIDADE", unidade: "UNIDADE", unidades: "UNIDADE", uni: "UNIDADE",
  pacote: "PACOTE", pct: "PACOTE",
  l: "LITRO", lt: "LITRO", litro: "LITRO", litros: "LITRO",
  ml: "ML", mililitro: "ML", mililitros: "ML",
  porcao: "PORCAO", porcoes: "PORCAO", porcaorat: "PORCAO",
  botijao: "BOTIJAO",
  caixa: "CAIXA", cx: "CAIXA",
};

const PRODUCT_CATEGORY_MAP: Record<string, ProductCategory> = {
  frango: "FRANGO", frangos: "FRANGO",
  costela: "COSTELA",
  suino: "SUINOS", suinos: "SUINOS", porco: "SUINOS",
  acompanhamento: "ACOMPANHAMENTOS", acompanhamentos: "ACOMPANHAMENTOS", side: "ACOMPANHAMENTOS",
  extra: "EXTRAS", extras: "EXTRAS", molho: "EXTRAS",
  bebida: "BEBIDAS", bebidas: "BEBIDAS",
};

const PRODUCT_TYPE_MAP: Record<string, ProductType> = {
  simples: "SIMPLES",
  acompanhamento: "ACOMPANHAMENTO",
  extra: "EXTRA",
  bebida: "BEBIDA",
  carnepura: "CARNE_PURA", carne: "CARNE_PURA",
};

const PRODUCT_STATUS_MAP: Record<string, ProductStatus> = {
  ativo: "ATIVO", active: "ATIVO",
  inativo: "INATIVO", inactive: "INATIVO",
  sobencomenda: "SOB_ENCOMENDA",
};

function mapEnum<T extends string>(value: unknown, map: Record<string, T>): T | null {
  const s = parseString(value);
  if (!s) return null;
  return map[norm(s)] ?? null;
}

// ============================================================
// PARSERS POR ABA
// ============================================================

type ParsedIngredient = {
  name: string;
  category: IngredientCategory;
  unit: IngredientUnit;
  unitCost: number;
  supplier: string | null;
  brand: string | null;
  notes: string | null;
};

function parseIngredients(rows: Record<string, unknown>[]): {
  rows: ParsedIngredient[];
  errors: { row: number; message: string }[];
} {
  const out: ParsedIngredient[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((raw, i) => {
    const rowNum = i + 2; // header é linha 1
    const name = parseString(pick(raw, ["nome", "name", "ingrediente"]));
    if (!name) {
      // pula linhas vazias silenciosamente
      const isEmpty = Object.values(raw).every((v) => v === null || v === "");
      if (!isEmpty) errors.push({ row: rowNum, message: "Sem nome" });
      return;
    }
    const category =
      mapEnum(pick(raw, ["categoria", "category", "cat"]), INGREDIENT_CATEGORY_MAP) ?? "OUTRO";
    const unit =
      mapEnum(pick(raw, ["unidade", "unit", "und"]), INGREDIENT_UNIT_MAP) ?? "UNIDADE";
    const unitCost = parseNumber(pick(raw, [
      "custo_unitario", "custounitario", "custo", "preco", "preco_unitario", "valor",
    ]));
    if (unitCost === null) {
      errors.push({ row: rowNum, message: `${name}: custo unitário ausente` });
      return;
    }
    out.push({
      name,
      category,
      unit,
      unitCost,
      supplier: parseString(pick(raw, ["fornecedor", "supplier"])),
      brand: parseString(pick(raw, ["marca", "brand"])),
      notes: parseString(pick(raw, ["observacoes", "notes", "obs"])),
    });
  });

  return { rows: out, errors };
}

type ParsedProduct = {
  name: string;
  category: ProductCategory;
  type: ProductType;
  portionLabel: string | null;
  salePrice: number | null;
  targetCmv: number | null;
  description: string | null;
  notes: string | null;
  status: ProductStatus;
};

function parseProducts(rows: Record<string, unknown>[]): {
  rows: ParsedProduct[];
  errors: { row: number; message: string }[];
} {
  const out: ParsedProduct[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((raw, i) => {
    const rowNum = i + 2;
    const name = parseString(pick(raw, ["nome", "name", "produto"]));
    if (!name) {
      const isEmpty = Object.values(raw).every((v) => v === null || v === "");
      if (!isEmpty) errors.push({ row: rowNum, message: "Sem nome" });
      return;
    }
    const category =
      mapEnum(pick(raw, ["categoria", "category"]), PRODUCT_CATEGORY_MAP) ?? "FRANGO";
    const type =
      mapEnum(pick(raw, ["tipo", "type"]), PRODUCT_TYPE_MAP) ?? "SIMPLES";
    const status =
      mapEnum(pick(raw, ["status"]), PRODUCT_STATUS_MAP) ?? "ATIVO";

    out.push({
      name,
      category,
      type,
      portionLabel: parseString(pick(raw, ["porcao", "portion", "rendimento"])),
      salePrice: parseNumber(pick(raw, ["preco_venda", "precovenda", "preco", "valor"])),
      targetCmv: parsePercent(pick(raw, ["meta_cmv", "metacmv", "cmv_meta", "cmv"])),
      description: parseString(pick(raw, ["descricao", "description", "desc"])),
      notes: parseString(pick(raw, ["observacoes", "notes", "obs"])),
      status,
    });
  });

  return { rows: out, errors };
}

type ParsedRecipeItem = {
  product: string;
  ingredient: string;
  quantity: number;
  notes: string | null;
};

function parseRecipeItems(rows: Record<string, unknown>[]): {
  rows: ParsedRecipeItem[];
  errors: { row: number; message: string }[];
} {
  const out: ParsedRecipeItem[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((raw, i) => {
    const rowNum = i + 2;
    const product = parseString(pick(raw, ["produto", "product"]));
    const ingredient = parseString(pick(raw, ["ingrediente", "ingredient"]));
    const quantity = parseNumber(pick(raw, ["quantidade", "qty", "qtd", "quantity"]));

    if (!product || !ingredient || quantity === null) {
      const isEmpty = Object.values(raw).every((v) => v === null || v === "");
      if (!isEmpty) {
        errors.push({
          row: rowNum,
          message: `Linha incompleta: produto=${product ?? "?"}, ingrediente=${ingredient ?? "?"}, quantidade=${quantity ?? "?"}`,
        });
      }
      return;
    }
    out.push({
      product,
      ingredient,
      quantity,
      notes: parseString(pick(raw, ["observacoes", "notes", "obs"])),
    });
  });

  return { rows: out, errors };
}

type ParsedCombo = {
  name: string;
  category: ProductCategory;
  description: string | null;
  salePrice: number | null;
  targetCmv: number | null;
  notes: string | null;
};

function parseCombos(rows: Record<string, unknown>[]): {
  rows: ParsedCombo[];
  errors: { row: number; message: string }[];
} {
  const out: ParsedCombo[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((raw, i) => {
    const rowNum = i + 2;
    const name = parseString(pick(raw, ["nome", "name", "combo"]));
    if (!name) {
      const isEmpty = Object.values(raw).every((v) => v === null || v === "");
      if (!isEmpty) errors.push({ row: rowNum, message: "Sem nome" });
      return;
    }
    const category =
      mapEnum(pick(raw, ["categoria", "category"]), PRODUCT_CATEGORY_MAP) ?? "FRANGO";
    out.push({
      name,
      category,
      description: parseString(pick(raw, ["descricao", "description"])),
      salePrice: parseNumber(pick(raw, ["preco_venda", "precovenda", "preco"])),
      targetCmv: parsePercent(pick(raw, ["meta_cmv", "cmv_meta", "cmv"])),
      notes: parseString(pick(raw, ["observacoes", "notes", "obs"])),
    });
  });

  return { rows: out, errors };
}

type ParsedComboItem = {
  combo: string;
  product: string;
  quantity: number;
};

function parseComboItems(rows: Record<string, unknown>[]): {
  rows: ParsedComboItem[];
  errors: { row: number; message: string }[];
} {
  const out: ParsedComboItem[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((raw, i) => {
    const rowNum = i + 2;
    const combo = parseString(pick(raw, ["combo", "nome_combo"]));
    const product = parseString(pick(raw, ["produto", "product", "item"]));
    const quantity = parseNumber(pick(raw, ["quantidade", "qty", "qtd"]));
    if (!combo || !product || quantity === null) {
      const isEmpty = Object.values(raw).every((v) => v === null || v === "");
      if (!isEmpty) {
        errors.push({
          row: rowNum,
          message: `Linha incompleta: combo=${combo ?? "?"}, produto=${product ?? "?"}, qtd=${quantity ?? "?"}`,
        });
      }
      return;
    }
    out.push({ combo, product, quantity });
  });

  return { rows: out, errors };
}

// ============================================================
// EXECUÇÃO
// ============================================================

export async function importSpreadsheet(
  buffer: Buffer,
  fileName: string,
  options: { mode: ImportMode; dryRun: boolean },
): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const detectedSheets = workbook.SheetNames;
  const summaries: SheetSummary[] = [];
  const warnings: string[] = [];

  // ---------- Localiza abas ----------
  const sheetIngredientes = findSheetName(workbook, ["Ingredientes", "Ingredients"]);
  const sheetProdutos = findSheetName(workbook, ["Produtos", "Products"]);
  const sheetFicha = findSheetName(workbook, [
    "Ficha_Tecnica", "FichaTecnica", "Fichas_Tecnicas", "FichasTecnicas", "Receitas",
  ]);
  const sheetCombos = findSheetName(workbook, ["Combos"]);
  const sheetComboItems = findSheetName(workbook, [
    "Combo_Itens", "Combo_Items", "ComboItens", "Itens_Combos",
  ]);

  if (!sheetIngredientes && !sheetProdutos && !sheetCombos && !sheetFicha) {
    warnings.push(
      "Nenhuma aba reconhecida. Aceitamos: Ingredientes, Produtos, Ficha_Tecnica, Combos, Combo_Itens.",
    );
  }
  if (sheetCombos && !sheetComboItems) {
    warnings.push("Aba 'Combos' encontrada mas sem 'Combo_Itens' — só metadados serão importados.");
  }

  // ---------- Parse ----------
  const parsedIng = sheetIngredientes
    ? parseIngredients(readSheet(workbook, sheetIngredientes))
    : { rows: [], errors: [] };
  const parsedProd = sheetProdutos
    ? parseProducts(readSheet(workbook, sheetProdutos))
    : { rows: [], errors: [] };
  const parsedRec = sheetFicha
    ? parseRecipeItems(readSheet(workbook, sheetFicha))
    : { rows: [], errors: [] };
  const parsedCombos = sheetCombos
    ? parseCombos(readSheet(workbook, sheetCombos))
    : { rows: [], errors: [] };
  const parsedComboItems = sheetComboItems
    ? parseComboItems(readSheet(workbook, sheetComboItems))
    : { rows: [], errors: [] };

  // ---------- Resolve estado existente ----------
  const existingIngNames = new Set(
    (await prisma.ingredient.findMany({ select: { name: true } })).map((i) => i.name),
  );
  const existingProdNames = new Set(
    (await prisma.product.findMany({ select: { name: true } })).map((p) => p.name),
  );
  const existingComboNames = new Set(
    (await prisma.combo.findMany({ select: { name: true } })).map((c) => c.name),
  );

  function classify(
    rows: { name?: string; product?: string; combo?: string }[],
    existingSet: Set<string>,
    nameKey: "name" | "product" | "combo",
  ): { create: number; update: number; skip: number } {
    let create = 0, update = 0, skip = 0;
    for (const r of rows) {
      const name = r[nameKey] as string | undefined;
      if (!name) {
        skip++;
        continue;
      }
      const exists = existingSet.has(name);
      if (exists) {
        if (options.mode === "create_only") skip++;
        else update++;
      } else {
        if (options.mode === "update_only") skip++;
        else create++;
      }
    }
    return { create, update, skip };
  }

  if (sheetIngredientes) {
    const c = classify(parsedIng.rows, existingIngNames, "name");
    summaries.push({
      sheet: "Ingredientes",
      detected: parsedIng.rows.length,
      willCreate: c.create,
      willUpdate: c.update,
      willSkip: c.skip,
      errors: parsedIng.errors,
    });
  }
  if (sheetProdutos) {
    const c = classify(parsedProd.rows, existingProdNames, "name");
    summaries.push({
      sheet: "Produtos",
      detected: parsedProd.rows.length,
      willCreate: c.create,
      willUpdate: c.update,
      willSkip: c.skip,
      errors: parsedProd.errors,
    });
  }
  if (sheetFicha) {
    // Para fichas, agrupamos por produto
    const byProduct = new Map<string, ParsedRecipeItem[]>();
    for (const r of parsedRec.rows) {
      const arr = byProduct.get(r.product) ?? [];
      arr.push(r);
      byProduct.set(r.product, arr);
    }
    summaries.push({
      sheet: "Ficha_Tecnica",
      detected: parsedRec.rows.length,
      willCreate: byProduct.size, // aproximação — cada produto é uma ficha
      willUpdate: 0,
      willSkip: 0,
      errors: parsedRec.errors,
    });
  }
  if (sheetCombos) {
    const c = classify(parsedCombos.rows, existingComboNames, "name");
    summaries.push({
      sheet: "Combos",
      detected: parsedCombos.rows.length,
      willCreate: c.create,
      willUpdate: c.update,
      willSkip: c.skip,
      errors: parsedCombos.errors,
    });
  }
  if (sheetComboItems) {
    const byCombo = new Set(parsedComboItems.rows.map((r) => r.combo));
    summaries.push({
      sheet: "Combo_Itens",
      detected: parsedComboItems.rows.length,
      willCreate: byCombo.size,
      willUpdate: 0,
      willSkip: 0,
      errors: parsedComboItems.errors,
    });
  }

  // ---------- Dry run? ----------
  if (options.dryRun) {
    return {
      fileName,
      detectedSheets,
      summaries,
      warnings,
      executed: false,
    };
  }

  // ---------- Execução real ----------
  const log = await prisma.$transaction(async (tx) => {
    // 1. Ingredientes (upsert)
    for (const ing of parsedIng.rows) {
      const exists = existingIngNames.has(ing.name);
      if (exists && options.mode === "create_only") continue;
      if (!exists && options.mode === "update_only") continue;

      await tx.ingredient.upsert({
        where: { name: ing.name },
        update: {
          category: ing.category,
          unit: ing.unit,
          unitCost: ing.unitCost,
          supplier: ing.supplier,
          brand: ing.brand,
          notes: ing.notes,
          lastPriceAt: new Date(),
        },
        create: {
          name: ing.name,
          category: ing.category,
          unit: ing.unit,
          unitCost: ing.unitCost,
          supplier: ing.supplier,
          brand: ing.brand,
          notes: ing.notes,
          lastPriceAt: new Date(),
        },
      });
    }

    // 2. Produtos
    for (const prod of parsedProd.rows) {
      const exists = existingProdNames.has(prod.name);
      if (exists && options.mode === "create_only") continue;
      if (!exists && options.mode === "update_only") continue;

      await tx.product.upsert({
        where: { name: prod.name },
        update: {
          category: prod.category,
          type: prod.type,
          portionLabel: prod.portionLabel,
          salePrice: prod.salePrice,
          targetCmv: prod.targetCmv,
          description: prod.description,
          notes: prod.notes,
          status: prod.status,
        },
        create: {
          name: prod.name,
          category: prod.category,
          type: prod.type,
          portionLabel: prod.portionLabel,
          salePrice: prod.salePrice,
          targetCmv: prod.targetCmv,
          description: prod.description,
          notes: prod.notes,
          status: prod.status,
        },
      });
    }

    // 3. Fichas técnicas (substitui itens por produto)
    if (parsedRec.rows.length > 0) {
      const byProduct = new Map<string, ParsedRecipeItem[]>();
      for (const r of parsedRec.rows) {
        const arr = byProduct.get(r.product) ?? [];
        arr.push(r);
        byProduct.set(r.product, arr);
      }

      for (const [productName, items] of byProduct) {
        const product = await tx.product.findUnique({ where: { name: productName } });
        if (!product) continue;

        const recipe = await tx.recipe.upsert({
          where: { productId: product.id },
          update: { reviewed: false, reviewedAt: null, reviewedById: null },
          create: { productId: product.id },
        });

        await tx.recipeItem.deleteMany({ where: { recipeId: recipe.id } });

        let total = 0;
        for (const item of items) {
          const ing = await tx.ingredient.findUnique({ where: { name: item.ingredient } });
          if (!ing) continue;
          const unitCost = Number(ing.unitCost);
          const totalCost = unitCost * item.quantity;
          total += totalCost;
          await tx.recipeItem.create({
            data: {
              recipeId: recipe.id,
              ingredientId: ing.id,
              quantity: item.quantity,
              unit: ing.unit,
              unitCostSnapshot: unitCost,
              totalCost,
              notes: item.notes,
            },
          });
        }
        await tx.recipe.update({ where: { id: recipe.id }, data: { totalCost: total } });
        await tx.product.update({ where: { id: product.id }, data: { totalCost: total } });
        // Cascata para combos (que podem ainda nem existir, mas se já existirem...)
        await cascadeProductCostToCombos(tx, product.id, total);
        // Recalcula o produto se ja tinha valor anterior (idempotente)
        await recalculateRecipeAndCascade(tx, recipe.id);
      }
    }

    // 4. Combos (metadados)
    for (const c of parsedCombos.rows) {
      const exists = existingComboNames.has(c.name);
      if (exists && options.mode === "create_only") continue;
      if (!exists && options.mode === "update_only") continue;

      await tx.combo.upsert({
        where: { name: c.name },
        update: {
          category: c.category,
          description: c.description,
          salePrice: c.salePrice,
          targetCmv: c.targetCmv,
          notes: c.notes,
        },
        create: {
          name: c.name,
          category: c.category,
          description: c.description,
          salePrice: c.salePrice,
          targetCmv: c.targetCmv,
          notes: c.notes,
        },
      });
    }

    // 5. Combo_Itens (substitui itens por combo)
    if (parsedComboItems.rows.length > 0) {
      const byCombo = new Map<string, ParsedComboItem[]>();
      for (const it of parsedComboItems.rows) {
        const arr = byCombo.get(it.combo) ?? [];
        arr.push(it);
        byCombo.set(it.combo, arr);
      }

      for (const [comboName, items] of byCombo) {
        const combo = await tx.combo.findUnique({ where: { name: comboName } });
        if (!combo) continue;

        await tx.comboItem.deleteMany({ where: { comboId: combo.id } });

        let total = 0;
        for (const item of items) {
          const product = await tx.product.findUnique({ where: { name: item.product } });
          if (!product) continue;
          const unitCost = Number(product.totalCost);
          const totalCost = unitCost * item.quantity;
          total += totalCost;
          await tx.comboItem.create({
            data: {
              comboId: combo.id,
              productId: product.id,
              quantity: item.quantity,
              unitCostSnapshot: unitCost,
              totalCost,
            },
          });
        }
        await tx.combo.update({ where: { id: combo.id }, data: { totalCost: total } });
      }
    }

    // 6. Cria ImportLog
    return tx.importLog.create({
      data: {
        fileName,
        status: parsedIng.errors.length + parsedProd.errors.length + parsedRec.errors.length + parsedCombos.errors.length + parsedComboItems.errors.length === 0
          ? "SUCESSO"
          : "PARCIAL",
        summary: { summaries, warnings } as unknown as Prisma.InputJsonValue,
        errors: undefined,
      },
    });
  });

  return {
    fileName,
    detectedSheets,
    summaries,
    warnings,
    executed: true,
    importLogId: log.id,
  };
}

export async function listRecentImports(limit = 10) {
  return prisma.importLog.findMany({
    orderBy: { importedAt: "desc" },
    take: limit,
  });
}

// re-export types for convenience
export type { ImportPreview };
