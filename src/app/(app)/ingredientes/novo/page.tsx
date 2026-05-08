import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { IngredientForm } from "@/components/ingredients/IngredientForm";

export default function NovoIngredientePage() {
  return (
    <div className="space-y-5">
      <Link
        href="/ingredientes"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para ingredientes
      </Link>

      <PageHeader
        title="Novo ingrediente"
        description="Cadastre um insumo. O preço unitário será usado nas fichas técnicas."
      />

      <Card>
        <CardContent className="p-6">
          <IngredientForm mode={{ type: "create" }} />
        </CardContent>
      </Card>
    </div>
  );
}
