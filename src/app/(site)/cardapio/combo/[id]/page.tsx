import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuItemDetail } from "@/components/public/MenuItemDetail";
import {
  getPublicMenuItem,
  getSiteSettings,
} from "@/server/services/public-menu.service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [item, settings] = await Promise.all([
    getPublicMenuItem("COMBO", id),
    getSiteSettings(),
  ]);
  if (!item) return { title: "Combo não encontrado" };
  const ogImage = item.imageUrl ?? "/logo.png";
  return {
    title: item.name,
    description:
      item.description ??
      item.ingredientsPublic ??
      `${item.name} — combo no cardápio da ${settings.businessName}.`,
    openGraph: {
      title: `${item.name} · ${settings.businessName}`,
      description:
        item.description ??
        item.ingredientsPublic ??
        settings.siteSlogan ??
        item.name,
      images: [{ url: ogImage, alt: item.name }],
      type: "website",
    },
    twitter: { images: [ogImage] },
  };
}

export default async function ComboDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getPublicMenuItem("COMBO", id);
  if (!item) notFound();
  return <MenuItemDetail item={item} />;
}
