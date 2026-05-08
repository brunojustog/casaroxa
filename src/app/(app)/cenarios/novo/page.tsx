import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScenarioForm } from "@/components/scenarios/ScenarioForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NovoCenarioPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const totalInvestment = settings
    ? Number(settings.investedAmount) + Number(settings.plannedInvestment)
    : 0;

  return (
    <div className="space-y-5">
      <Link
        href="/cenarios"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para cenários
      </Link>

      <PageHeader
        title="Novo cenário"
        description="Veja a projeção mensal e payback à direita conforme você ajusta as premissas."
      />

      <ScenarioForm
        mode={{ type: "create" }}
        fixedMonthlyCost={settings ? Number(settings.fixedMonthlyCost) : 0}
        totalInvestment={totalInvestment}
      />
    </div>
  );
}
