import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FixedCostForm } from "@/components/fixed-costs/FixedCostForm";
import { FixedCostHistory } from "@/components/fixed-costs/FixedCostHistory";
import { getFixedCostItemById } from "@/server/services/fixed-costs.service";
import { FIXED_COST_CATEGORY_LABEL } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function EditarCustoFixoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getFixedCostItemById(id);
  if (!item) notFound();

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
        title={item.name}
        description={FIXED_COST_CATEGORY_LABEL[item.category]}
        actions={
          item.active ? (
            <Badge tone="success">Ativo</Badge>
          ) : (
            <Badge tone="neutral">Inativo</Badge>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              <FixedCostForm
                mode={{ type: "edit", id: item.id }}
                defaultValues={{
                  name: item.name,
                  category: item.category,
                  frequency: item.frequency,
                  amount: Number(item.amount),
                  notes: item.notes,
                  active: item.active,
                }}
              />
            </CardContent>
          </Card>
        </div>

        <aside>
          <FixedCostHistory history={item.history} />
        </aside>
      </div>
    </div>
  );
}
