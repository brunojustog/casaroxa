import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScenarioForm } from "@/components/scenarios/ScenarioForm";
import { getScenarioById } from "@/server/services/scenario.service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditarCenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [scenario, settings] = await Promise.all([
    getScenarioById(id),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  if (!scenario) notFound();

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
        title={scenario.name}
        description="Ajuste as premissas e veja o impacto à direita."
      />

      <ScenarioForm
        mode={{ type: "edit", id: scenario.id }}
        initial={{
          name: scenario.name,
          ordersPerWeekend: scenario.ordersPerWeekend,
          averageTicket: Number(scenario.averageTicket),
          weekendsPerMonth: scenario.weekendsPerMonth,
          estimatedCmvPercent: Number(scenario.estimatedCmvPercent),
          notes: scenario.notes,
        }}
        fixedMonthlyCost={settings ? Number(settings.fixedMonthlyCost) : 0}
        totalInvestment={totalInvestment}
      />
    </div>
  );
}
