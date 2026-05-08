import Link from "next/link";
import { ChevronRight, FileBarChart2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REPORT_LIST } from "@/server/services/report.service";

export default function RelatoriosIndexPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Relatórios"
        description="12 relatórios prontos. Cada um aceita filtros e pode ser exportado em CSV ou PDF."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_LIST.map((r) => (
          <Link key={r.type} href={`/relatorios/${r.type}`}>
            <Card className="hover:border-roxa-300 hover:shadow-md transition cursor-pointer h-full">
              <CardHeader className="flex-row items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-roxa-50 text-roxa-700">
                  <FileBarChart2 className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <CardTitle className="flex items-center justify-between text-base gap-2">
                    {r.title}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 leading-relaxed">{r.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
