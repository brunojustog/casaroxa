/**
 * Service para o cardápio online público (sem auth).
 *
 * Filtra produtos/combos com showInMenu=true, ativos e com preço > 0.
 * Expõe apenas o que é seguro mostrar na web pública (nada de custo, CMV,
 * fichas técnicas, dados internos).
 */
import { prisma } from "@/lib/prisma";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/enums";
import { IngredientCategory, type ProductCategory } from "@prisma/client";

/** Converte o campo Json gallery (array de URLs) com fallback para []. */
function parseGallery(value: unknown): string[] {
  if (!value || !Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * Categorias de ingrediente que aparecem para o cliente final.
 * Embalagem, gás e limpeza ficam de fora — fazem parte da operação,
 * não da experiência do prato.
 */
const PUBLIC_INGREDIENT_CATEGORIES = new Set<IngredientCategory>([
  IngredientCategory.CARNE,
  IngredientCategory.TEMPERO,
  IngredientCategory.ACOMPANHAMENTO,
  IngredientCategory.BEBIDA,
  IngredientCategory.OUTRO,
]);

function dedup<T>(arr: T[]): T[] {
  return arr.filter((v, i, a) => a.indexOf(v) === i);
}

function deriveIngredientsFromRecipe(
  items: Array<{ ingredient: { name: string; category: IngredientCategory } }>,
): string {
  const names = dedup(
    items
      .filter((it) => PUBLIC_INGREDIENT_CATEGORIES.has(it.ingredient.category))
      .map((it) => it.ingredient.name),
  );
  return names.join(", ");
}

function deriveIngredientsFromCombo(
  items: Array<{ product: { name: string } }>,
): string {
  return dedup(items.map((it) => it.product.name)).join(", ");
}

export async function getPublicMenuItem(
  kind: "PRODUTO" | "COMBO",
  id: string,
): Promise<PublicMenuItem | null> {
  if (kind === "PRODUTO") {
    const p = await prisma.product.findFirst({
      where: { id, showInMenu: true, active: true, salePrice: { gt: 0 } },
      select: {
        id: true,
        name: true,
        description: true,
        salePrice: true,
        imageUrl: true,
        portionLabel: true,
        category: true,
        status: true,
        ingredientsPublic: true,
        gallery: true,
        youtubeUrl: true,
        recipe: {
          select: {
            items: {
              orderBy: { totalCost: "desc" },
              select: {
                ingredient: { select: { name: true, category: true } },
              },
            },
          },
        },
      },
    });
    if (!p) return null;
    // Se Bruno preencheu manual, usa. Senão, deriva da ficha técnica filtrada.
    const derived =
      p.ingredientsPublic && p.ingredientsPublic.trim().length > 0
        ? p.ingredientsPublic
        : p.recipe
          ? deriveIngredientsFromRecipe(p.recipe.items) || null
          : null;
    return {
      id: p.id,
      kind: "PRODUTO",
      name: p.name,
      description: p.description,
      price: Number(p.salePrice ?? 0),
      imageUrl: p.imageUrl,
      portionLabel: p.portionLabel,
      category: p.category,
      ingredientsPublic: derived,
      gallery: parseGallery(p.gallery),
      youtubeUrl: p.youtubeUrl,
      savings: null,
      topPick: false,
      sobEncomenda: p.status === "SOB_ENCOMENDA",
    };
  }
  const c = await prisma.combo.findFirst({
    where: { id, showInMenu: true, active: true, salePrice: { gt: 0 } },
    select: {
      id: true,
      name: true,
      description: true,
      salePrice: true,
      imageUrl: true,
      category: true,
      ingredientsPublic: true,
      gallery: true,
      youtubeUrl: true,
      items: {
        orderBy: { totalCost: "desc" },
        select: {
          product: { select: { name: true } },
        },
      },
    },
  });
  if (!c) return null;
  // Combo: se manual vazio, lista os produtos componentes (mais legível
  // que expandir todas as fichas). Bruno pode editar pra deixar mais bonito.
  const derived =
    c.ingredientsPublic && c.ingredientsPublic.trim().length > 0
      ? c.ingredientsPublic
      : deriveIngredientsFromCombo(c.items) || null;
  return {
    id: c.id,
    kind: "COMBO",
    name: c.name,
    description: c.description,
    price: Number(c.salePrice ?? 0),
    imageUrl: c.imageUrl,
    portionLabel: null,
    category: c.category,
    ingredientsPublic: derived,
    gallery: parseGallery(c.gallery),
    youtubeUrl: c.youtubeUrl,
    savings: null,
    topPick: false,
    sobEncomenda: false,
  };
}

export type PublicMenuItem = {
  id: string;
  kind: "PRODUTO" | "COMBO";
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  portionLabel: string | null;
  category: ProductCategory;
  ingredientsPublic: string | null;
  gallery: string[];
  youtubeUrl: string | null;
  /** Combo: diferença positiva entre soma dos items individuais e o
   *  preço do combo. null se não é combo ou não há economia. */
  savings: number | null;
  /** Top N mais vendidos nos últimos 30 dias — ganha badge "Mais pedido". */
  topPick: boolean;
  /** Product.status === SOB_ENCOMENDA: aparece no cardápio com badge e
   *  CTA "Encomendar" (fluxo /encomenda) em vez do carrinho. */
  sobEncomenda: boolean;
};

export type PublicMenuCategory = {
  category: ProductCategory | "COMBOS";
  label: string;
  /** Foto representativa: primeiro item da categoria com imageUrl, se houver. */
  coverImageUrl: string | null;
  items: PublicMenuItem[];
};

// EMPORIO fica de fora do cardápio principal de propósito — tem vitrine
// própria em /emporio (getEmporioMenu).
const CATEGORY_ORDER: Array<ProductCategory | "COMBOS"> = [
  "COMBOS", // Combos primeiro — orientação a ticket
  "FRANGO",
  "COSTELA",
  "SUINOS",
  "ACOMPANHAMENTOS",
  "CONGELADOS",
  "EXTRAS",
  "BEBIDAS",
];

const TOP_PICK_COUNT = 3;

/** Top N produtos/combos mais vendidos nos últimos 30d (Sales CONCLUIDA). */
async function getTopPickIds(): Promise<{
  productIds: Set<string>;
  comboIds: Set<string>;
}> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const items = await prisma.saleItem.groupBy({
    by: ["productId", "comboId"],
    where: {
      sale: { status: "CONCLUIDA", occurredAt: { gte: cutoff } },
    },
    _count: { _all: true },
  });
  const productRanks = items
    .filter((i) => i.productId)
    .map((i) => ({ id: i.productId!, n: i._count._all }))
    .sort((a, b) => b.n - a.n)
    .slice(0, TOP_PICK_COUNT)
    .map((i) => i.id);
  const comboRanks = items
    .filter((i) => i.comboId)
    .map((i) => ({ id: i.comboId!, n: i._count._all }))
    .sort((a, b) => b.n - a.n)
    .slice(0, TOP_PICK_COUNT)
    .map((i) => i.id);
  return {
    productIds: new Set(productRanks),
    comboIds: new Set(comboRanks),
  };
}

/** Pra cada combo, soma os preços dos items individuais (ComboItem ×
 *  Product.salePrice). Diferença positiva é a "economia". */
async function getComboSavings(): Promise<Map<string, number>> {
  const combos = await prisma.combo.findMany({
    where: { active: true, showInMenu: true },
    select: {
      id: true,
      salePrice: true,
      items: {
        select: {
          quantity: true,
          product: { select: { salePrice: true } },
        },
      },
    },
  });
  const out = new Map<string, number>();
  for (const c of combos) {
    if (!c.salePrice) continue;
    let sumIndividual = 0;
    for (const ci of c.items) {
      const unit = Number(ci.product?.salePrice ?? 0);
      sumIndividual += unit * Number(ci.quantity);
    }
    const diff = sumIndividual - Number(c.salePrice);
    if (diff > 0) out.set(c.id, diff);
  }
  return out;
}

export async function getPublicMenu(): Promise<PublicMenuCategory[]> {
  const [products, combos, topPicks, comboSavings] = await Promise.all([
    prisma.product.findMany({
      where: {
        showInMenu: true,
        active: true,
        salePrice: { gt: 0 },
        category: { not: "EMPORIO" },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        salePrice: true,
        imageUrl: true,
        portionLabel: true,
        category: true,
        status: true,
        ingredientsPublic: true,
        gallery: true,
        youtubeUrl: true,
      },
    }),
    prisma.combo.findMany({
      where: {
        showInMenu: true,
        active: true,
        salePrice: { gt: 0 },
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        salePrice: true,
        imageUrl: true,
        category: true,
        ingredientsPublic: true,
        gallery: true,
        youtubeUrl: true,
      },
    }),
    getTopPickIds(),
    getComboSavings(),
  ]);

  const productItems: PublicMenuItem[] = products.map((p) => ({
    id: p.id,
    kind: "PRODUTO",
    name: p.name,
    description: p.description,
    price: Number(p.salePrice ?? 0),
    imageUrl: p.imageUrl,
    portionLabel: p.portionLabel,
    category: p.category,
    ingredientsPublic: p.ingredientsPublic,
    gallery: parseGallery(p.gallery),
    youtubeUrl: p.youtubeUrl,
    savings: null,
    topPick: topPicks.productIds.has(p.id),
    sobEncomenda: p.status === "SOB_ENCOMENDA",
  }));

  const comboItems: PublicMenuItem[] = combos.map((c) => ({
    id: c.id,
    kind: "COMBO",
    name: c.name,
    description: c.description,
    price: Number(c.salePrice ?? 0),
    imageUrl: c.imageUrl,
    portionLabel: null,
    category: c.category,
    ingredientsPublic: c.ingredientsPublic,
    gallery: parseGallery(c.gallery),
    youtubeUrl: c.youtubeUrl,
    savings: comboSavings.get(c.id) ?? null,
    topPick: topPicks.comboIds.has(c.id),
    sobEncomenda: false,
  }));

  // Dentro de cada categoria, ordena: topPick primeiro, depois savings desc, depois alfabético
  function sortInCategory(items: PublicMenuItem[]): PublicMenuItem[] {
    return [...items].sort((a, b) => {
      if (a.topPick !== b.topPick) return a.topPick ? -1 : 1;
      const sa = a.savings ?? 0;
      const sb = b.savings ?? 0;
      if (sa !== sb) return sb - sa;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }

  // Agrupa: produtos por sua categoria, combos numa categoria virtual "COMBOS"
  const byCategory = new Map<ProductCategory | "COMBOS", PublicMenuItem[]>();
  for (const it of productItems) {
    const arr = byCategory.get(it.category) ?? [];
    arr.push(it);
    byCategory.set(it.category, arr);
  }
  if (comboItems.length > 0) {
    byCategory.set("COMBOS", comboItems);
  }

  return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => {
    const items = sortInCategory(byCategory.get(c) ?? []);
    const cover = items.find((i) => i.imageUrl)?.imageUrl ?? null;
    return {
      category: c,
      label: c === "COMBOS" ? "Combos" : PRODUCT_CATEGORY_LABEL[c as ProductCategory],
      coverImageUrl: cover,
      items,
    };
  });
}

/**
 * Vitrine do Empório: produtos de revenda (categoria EMPORIO) com preço e
 * visíveis no menu. Disponíveis primeiro, sob encomenda no fim — cada grupo
 * em ordem alfabética.
 */
export async function getEmporioMenu(): Promise<PublicMenuItem[]> {
  const products = await prisma.product.findMany({
    where: {
      showInMenu: true,
      active: true,
      salePrice: { gt: 0 },
      category: "EMPORIO",
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      salePrice: true,
      imageUrl: true,
      portionLabel: true,
      category: true,
      status: true,
      ingredientsPublic: true,
      gallery: true,
      youtubeUrl: true,
    },
  });

  const items: PublicMenuItem[] = products.map((p) => ({
    id: p.id,
    kind: "PRODUTO",
    name: p.name,
    description: p.description,
    price: Number(p.salePrice ?? 0),
    imageUrl: p.imageUrl,
    portionLabel: p.portionLabel,
    category: p.category,
    ingredientsPublic: p.ingredientsPublic,
    gallery: parseGallery(p.gallery),
    youtubeUrl: p.youtubeUrl,
    savings: null,
    topPick: false,
    sobEncomenda: p.status === "SOB_ENCOMENDA",
  }));

  return items.sort((a, b) => {
    if (a.sobEncomenda !== b.sobEncomenda) return a.sobEncomenda ? 1 : -1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export type PublicSiteSettings = {
  businessName: string;
  siteSlogan: string | null;
  whatsappNumber: string | null;
  emporioWhatsappGroupUrl: string | null;
  address: string | null;
  addressNeighborhood: string | null;
  openingHours: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  asaasEnabled: boolean;
  deliveryFeeNote: string | null;
  minimumOrderValue: number | null;
  heroPromoTitle: string | null;
  heroPromoText: string | null;
  heroPromoImageUrl: string | null;
  heroPromoLinkLabel: string | null;
  heroPromoLinkHref: string | null;
};

export async function getSiteSettings(): Promise<PublicSiteSettings> {
  const s = await prisma.settings.findUnique({
    where: { id: 1 },
    select: {
      businessName: true,
      siteSlogan: true,
      whatsappNumber: true,
      emporioWhatsappGroupUrl: true,
      address: true,
      addressNeighborhood: true,
      openingHours: true,
      instagramUrl: true,
      facebookUrl: true,
      pickupEnabled: true,
      deliveryEnabled: true,
      asaasEnabled: true,
      deliveryFeeNote: true,
      minimumOrderValue: true,
      heroPromoTitle: true,
      heroPromoText: true,
      heroPromoImageUrl: true,
      heroPromoLinkLabel: true,
      heroPromoLinkHref: true,
    },
  });

  return {
    businessName: s?.businessName ?? "Casa Roxa Assados",
    siteSlogan: s?.siteSlogan ?? null,
    whatsappNumber: s?.whatsappNumber ?? null,
    emporioWhatsappGroupUrl: s?.emporioWhatsappGroupUrl ?? null,
    address: s?.address ?? null,
    addressNeighborhood: s?.addressNeighborhood ?? null,
    openingHours: s?.openingHours ?? null,
    instagramUrl: s?.instagramUrl ?? null,
    facebookUrl: s?.facebookUrl ?? null,
    pickupEnabled: s?.pickupEnabled ?? true,
    deliveryEnabled: s?.deliveryEnabled ?? true,
    asaasEnabled: s?.asaasEnabled ?? false,
    deliveryFeeNote: s?.deliveryFeeNote ?? null,
    minimumOrderValue:
      s?.minimumOrderValue !== null && s?.minimumOrderValue !== undefined
        ? Number(s.minimumOrderValue)
        : null,
    heroPromoTitle: s?.heroPromoTitle ?? null,
    heroPromoText: s?.heroPromoText ?? null,
    heroPromoImageUrl: s?.heroPromoImageUrl ?? null,
    heroPromoLinkLabel: s?.heroPromoLinkLabel ?? null,
    heroPromoLinkHref: s?.heroPromoLinkHref ?? null,
  };
}
