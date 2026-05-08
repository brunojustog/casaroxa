import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { FixedCostForm } from "@/components/fixed-costs/FixedCostForm";

export default function NovoCustoFixoPage() {
  return (
    <div className="space-y-5">
      <Link
        href="/custos-fixos"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para custos fixos
      </Link>

      <PageHeader
        title="Novo item de custo fixo"
        description="Cadastre um componente do custo fixo mensal (aluguel, energia, etc.)."
      />

      <Card>
        <CardContent className="p-6">
          <FixedCostForm mode={{ type: "create" }} />
        </CardContent>
      </Card>
    </div>
  );
}
