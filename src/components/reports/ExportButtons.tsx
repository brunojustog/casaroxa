"use client";

import { useSearchParams } from "next/navigation";
import { Download, FileText } from "lucide-react";

export function ExportButtons({ reportType }: { reportType: string }) {
  const params = useSearchParams();
  const qs = params.toString();
  const csvHref = `/api/export/csv?type=${encodeURIComponent(reportType)}${qs ? `&${qs}` : ""}`;
  const pdfHref = `/api/export/pdf?type=${encodeURIComponent(reportType)}${qs ? `&${qs}` : ""}`;

  return (
    <div className="flex items-center gap-2">
      <a
        href={csvHref}
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        title="Exportar CSV"
      >
        <Download className="h-4 w-4" />
        CSV
      </a>
      <a
        href={pdfHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        title="Exportar PDF"
      >
        <FileText className="h-4 w-4" />
        PDF
      </a>
    </div>
  );
}
