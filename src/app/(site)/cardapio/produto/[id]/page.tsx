import { notFound } from "next/navigation";
import { MenuItemDetail } from "@/components/public/MenuItemDetail";
import { getPublicMenuItem } from "@/server/services/public-menu.service";

export const dynamic = "force-dynamic";

export default async function ProdutoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getPublicMenuItem("PRODUTO", id);
  if (!item) notFound();
  return <MenuItemDetail item={item} />;
}
