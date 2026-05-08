import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import {
  ComboEditor,
  type EditorProduct,
  type EditorComboItem,
} from "@/components/combos/ComboEditor";
import {
  getActiveProductsForCombos,
  getComboById,
} from "@/server/services/combo.service";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function EditarComboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [combo, products] = await Promise.all([
    getComboById(id),
    getActiveProductsForCombos(),
  ]);

  if (!combo) notFound();

  // Garante que produtos referenciados pelo combo (mesmo inativos) apareçam
  // como opção selecionável — caso contrário, o select ficaria com value órfão.
  const productMap = new Map<string, EditorProduct>(
    products.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        category: p.category,
        portionLabel: p.portionLabel,
        totalCost: Number(p.totalCost),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
      },
    ]),
  );
  for (const it of combo.items) {
    if (!productMap.has(it.productId)) {
      productMap.set(it.productId, {
        id: it.productId,
        name: `${it.product.name} (inativo)`,
        category: it.product.category,
        portionLabel: it.product.portionLabel,
        totalCost: Number(it.product.totalCost),
        salePrice: it.product.salePrice ? Number(it.product.salePrice) : null,
      });
    }
  }

  const initialItems: EditorComboItem[] = combo.items.map((it) => ({
    key: it.id,
    productId: it.productId,
    quantity: String(Number(it.quantity)),
  }));

  const targetPercent = combo.targetCmv
    ? String(Number(combo.targetCmv) * 100)
    : "45";

  return (
    <div className="space-y-5">
      <Link
        href="/combos"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para combos
      </Link>

      <PageHeader
        title={combo.name}
        description={PRODUCT_CATEGORY_LABEL[combo.category]}
        actions={
          combo.active ? (
            <Badge tone="success">Ativo</Badge>
          ) : (
            <Badge tone="neutral">Inativo</Badge>
          )
        }
      />

      <ComboEditor
        mode={{ type: "edit", id: combo.id }}
        initialName={combo.name}
        initialCategory={combo.category}
        initialDescription={combo.description ?? ""}
        initialSalePrice={combo.salePrice ? String(Number(combo.salePrice)) : ""}
        initialTargetCmvPercent={targetPercent}
        initialNotes={combo.notes ?? ""}
        initialActive={combo.active}
        initialImageUrl={combo.imageUrl ?? ""}
        initialShowInMenu={combo.showInMenu}
        initialIngredientsPublic={combo.ingredientsPublic ?? ""}
        initialGallery={
          Array.isArray(combo.gallery)
            ? (combo.gallery as string[]).join("\n")
            : ""
        }
        initialYoutubeUrl={combo.youtubeUrl ?? ""}
        initialItems={initialItems}
        products={Array.from(productMap.values())}
      />
    </div>
  );
}
