import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComboEditor, type EditorProduct } from "@/components/combos/ComboEditor";
import { getActiveProductsForCombos } from "@/server/services/combo.service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NovoComboPage() {
  const [products, settings] = await Promise.all([
    getActiveProductsForCombos(),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  const editorProducts: EditorProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    portionLabel: p.portionLabel,
    totalCost: Number(p.totalCost),
    salePrice: p.salePrice ? Number(p.salePrice) : null,
  }));

  const defaultTargetPercent = settings
    ? String(Number(settings.defaultCmvCombos) * 100)
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
        title="Novo combo"
        description="Monte o combo escolhendo produtos. Custo, CMV e lucro recalculam em tempo real."
      />

      <ComboEditor
        mode={{ type: "create" }}
        initialName=""
        initialCategory="FRANGO"
        initialDescription=""
        initialSalePrice=""
        initialTargetCmvPercent={defaultTargetPercent}
        initialNotes=""
        initialActive={true}
        initialItems={[]}
        products={editorProducts}
      />
    </div>
  );
}
