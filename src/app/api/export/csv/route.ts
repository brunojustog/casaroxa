import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { rowsToCsv } from "@/server/exporters/csv-exporter";
import { getReport } from "@/server/services/report.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (!type) {
    return NextResponse.json({ error: "Tipo de relatório obrigatório" }, { status: 400 });
  }

  const def = getReport(type);
  if (!def) {
    return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  }

  // Remove "type" dos params usados no fetch
  const fetchParams = new URLSearchParams(url.searchParams);
  fetchParams.delete("type");

  const rows = await def.fetch(fetchParams);
  const csv = rowsToCsv(def.columns, rows);

  const filename = `casa-roxa_${def.type}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
