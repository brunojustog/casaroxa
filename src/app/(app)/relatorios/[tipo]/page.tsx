import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportTable } from "@/components/reports/ReportTable";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { getReport } from "@/server/services/report.service";

export const dynamic = "force-dynamic";

export default async function RelatorioPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tipo } = await params;
  const def = getReport(tipo);
  if (!def) notFound();

  const sp = await searchParams;
  const usp = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (typeof val === "string" && val.length > 0) usp.set(key, val);
  }

  const rows = await def.fetch(usp);

  return (
    <div className="space-y-5">
      <Link
        href="/relatorios"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para relatórios
      </Link>

      <PageHeader
        title={def.title}
        description={def.description}
        actions={<ExportButtons reportType={def.type} />}
      />

      {def.filters.length > 0 && (
        <ReportFilters reportType={def.type} filters={def.filters} />
      )}

      <ReportTable columns={def.columns} rows={rows} />

      <div className="text-xs text-slate-500">
        {rows.length} registro{rows.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
