import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { rowsToPdf } from "@/server/exporters/pdf-exporter";
import { getReport } from "@/server/services/report.service";

// Força runtime Node (jsPDF/autotable não roda no Edge).
export const runtime = "nodejs";
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

  const fetchParams = new URLSearchParams(url.searchParams);
  fetchParams.delete("type");

  const rows = await def.fetch(fetchParams);
  const pdfBytes = rowsToPdf({
    title: def.title,
    description: def.description,
    columns: def.columns,
    rows,
  });

  const filename = `casa-roxa_${def.type}_${new Date().toISOString().slice(0, 10)}.pdf`;

  // Cast para BodyInit — Uint8Array é válido como body em runtime Node,
  // mas o tipo do Next 15 é estrito.
  return new NextResponse(pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
