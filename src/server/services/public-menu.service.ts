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
};

export type PublicMenuCategory = {
  category: ProductCategory | "COMBOS";
  label: string;
  /** Foto representativa: primeiro item da categoria com imageUrl, se houver. */
  coverImageUrl: string | null;
  items: PublicMenuItem[];
};

const CATEGORY_ORDER: Array<ProductCategory | "COMBOS"> = [
  "FRANGO",
  "COSTELA",
  "SUINOS",
  "ACOMPANHAMENTOS",
  "EXTRAS",
  "BEBIDAS",
  "COMBOS",
];

export async function getPublicMenu(): Promise<PublicMenuCategory[]> {
  const [products, combos] = await Promise.all([
    prisma.product.findMany({
      where: {
        showInMenu: true,
        active: true,
        salePrice: { gt: 0 },
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
  }));

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
    const items = byCategory.get(c) ?? [];
    const cover = items.find((i) => i.imageUrl)?.imageUrl ?? null;
    return {
      category: c,
      label: c === "COMBOS" ? "Combos" : PRODUCT_CATEGORY_LABEL[c as ProductCategory],
      coverImageUrl: cover,
      items,
    };
  });
}

export type PublicSiteSettings = {
  businessName: string;
  siteSlogan: string | null;
  whatsappNumber: string | null;
  address: string | null;
  addressNeighborhood: string | null;
  openingHours: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
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
      address: true,
      addressNeighborhood: true,
      openingHours: true,
      instagramUrl: true,
      facebookUrl: true,
      pickupEnabled: true,
      deliveryEnabled: true,
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
    address: s?.address ?? null,
    addressNeighborhood: s?.addressNeighborhood ?? null,
    openingHours: s?.openingHours ?? null,
    instagramUrl: s?.instagramUrl ?? null,
    facebookUrl: s?.facebookUrl ?? null,
    pickupEnabled: s?.pickupEnabled ?? true,
    deliveryEnabled: s?.deliveryEnabled ?? true,
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
