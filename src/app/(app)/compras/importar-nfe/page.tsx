import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  NfeImporter,
  type AvailableIngredient,
  type AvailableSupplier,
} from "@/components/purchases/NfeImporter";
import { listActiveSuppliers } from "@/server/services/supplier.service";
import { getActiveIngredientsForStock } from "@/server/services/stock.service";

export const dynamic = "force-dynamic";

export default async function ImportarNfePage() {
  const [suppliers, ingredients] = await Promise.all([
    listActiveSuppliers(),
    getActiveIngredientsForStock(),
  ]);

  const availableSuppliers: AvailableSupplier[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
  }));
  const availableIngredients: AvailableIngredient[] = ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    unit: i.unit,
  }));

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
        title="Importar NFe (XML)"
        description="Suba o XML da nota fiscal eletrônica. O sistema detecta automaticamente o fornecedor e os ingredientes; você confirma o matching e escolhe se já confirma ou salva como rascunho."
      />

      <NfeImporter
        suppliers={availableSuppliers}
        ingredients={availableIngredients}
      />
    </div>
  );
}
