import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  StockMovementForm,
  type StockFormIngredient,
} from "@/components/stock/StockMovementForm";
import { getActiveIngredientsForStock } from "@/server/services/stock.service";
import type { StockMovementType } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_TYPES: StockMovementType[] = ["ENTRADA", "SAIDA", "PERDA", "AJUSTE"];

export default async function LancarMovimentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ingredientId =
    typeof params.ingredientId === "string" ? params.ingredientId : undefined;
  const typeRaw = typeof params.type === "string" ? params.type : undefined;
  const preselectedType = VALID_TYPES.includes(typeRaw as StockMovementType)
    ? (typeRaw as StockMovementType)
    : undefined;

  const ingredients = await getActiveIngredientsForStock();
  const formIngredients: StockFormIngredient[] = ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    unit: i.unit,
    unitCost: Number(i.unitCost),
  }));

  return (
    <div className="space-y-5">
      <Link
        href="/estoque"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para estoque
      </Link>

      <PageHeader
        title="Lançar movimento"
        description="Registre uma entrada, saída, perda ou ajuste manual no estoque."
      />

      <StockMovementForm
        ingredients={formIngredients}
        preselectedIngredientId={ingredientId}
        preselectedType={preselectedType}
      />
    </div>
  );
}
