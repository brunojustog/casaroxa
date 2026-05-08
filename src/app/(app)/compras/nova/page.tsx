import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  PurchaseEditor,
  type EditorIngredient,
  type EditorSupplier,
} from "@/components/purchases/PurchaseEditor";
import { listActiveSuppliers } from "@/server/services/supplier.service";
import { getActiveIngredientsForStock } from "@/server/services/stock.service";

export const dynamic = "force-dynamic";

export default async function NovaCompraPage() {
  const [ingredients, suppliers] = await Promise.all([
    getActiveIngredientsForStock(),
    listActiveSuppliers(),
  ]);

  const editorIngredients: EditorIngredient[] = ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    unit: i.unit,
    unitCost: Number(i.unitCost),
  }));

  const editorSuppliers: EditorSupplier[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  // Data padrão = hoje no formato yyyy-mm-dd
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <Link
        href="/compras"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para compras
      </Link>

      <PageHeader
        title="Nova compra"
        description="Cadastre como rascunho. Confirme depois para alimentar o estoque e atualizar custos."
      />

      <PurchaseEditor
        mode={{ type: "create" }}
        initialSupplierId=""
        initialInvoiceNumber=""
        initialInvoiceDate={today}
        initialNotes=""
        initialItems={[]}
        ingredients={editorIngredients}
        suppliers={editorSuppliers}
      />
    </div>
  );
}
