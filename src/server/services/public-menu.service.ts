/**
 * Service para o cardápio online público (sem auth).
 *
 * Filtra produtos/combos com showInMenu=true, ativos e com preço > 0.
 * Expõe apenas o que é seguro mostrar na web pública (nada de custo, CMV,
 * fichas técnicas, dados internos).
 */
import { prisma } from "@/lib/prisma";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/enums";
import type { ProductCategory } from "@prisma/client";

export type PublicMenuItem = {
  id: string;
  kind: "PRODUTO" | "COMBO";
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  portionLabel: string | null;
  category: ProductCategory;
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
  };
}
