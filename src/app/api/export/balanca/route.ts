/**
 * GET /api/export/balanca — carga de itens pra balança Toledo.
 *
 * Gera o ITENSMGV.TXT (layout oficial, retrocompatível MGV5/6/7) com todos
 * os produtos ativos que têm código de balança e preço. Baixar o arquivo,
 * colocar na pasta configurada do MGV (padrão C:\TOLEDO) e importar/enviar.
 */
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import {
  buildItensMgvTxt,
  loadBalancaItems,
} from "@/server/exporters/balanca-exporter";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const items = await loadBalancaItems();
  if (items.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nenhum produto com código de balança cadastrado. Preencha o campo \"Código na balança\" nos produtos.",
      },
      { status: 404 },
    );
  }

  const txt = buildItensMgvTxt(items);

  return new NextResponse(txt, {
    status: 200,
    headers: {
      // ASCII puro — o MGV não entende UTF-8 com acentos.
      "Content-Type": "text/plain; charset=ascii",
      "Content-Disposition": 'attachment; filename="ITENSMGV.TXT"',
      "Cache-Control": "no-store",
    },
  });
}
