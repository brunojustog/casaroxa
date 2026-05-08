import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XlsxUploader } from "@/components/importer/XlsxUploader";
import { listRecentImports } from "@/server/importers/xlsx-importer";
import { IMPORT_STATUS_LABEL } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const recent = await listRecentImports(10);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Importar Planilha"
        description="Suba uma planilha XLSX da operação para popular ingredientes, produtos, fichas técnicas e combos."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <XlsxUploader />
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Formato esperado</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-3">
              <div>
                <p className="font-semibold text-slate-700">Aba Ingredientes</p>
                <p className="mt-0.5">
                  Colunas: <code>nome</code>, <code>categoria</code>,{" "}
                  <code>unidade</code>, <code>custo_unitario</code>,{" "}
                  <code>fornecedor</code>, <code>marca</code>,{" "}
                  <code>observacoes</code>
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Aba Produtos</p>
                <p className="mt-0.5">
                  Colunas: <code>nome</code>, <code>categoria</code>,{" "}
                  <code>tipo</code>, <code>porcao</code>,{" "}
                  <code>preco_venda</code>, <code>meta_cmv</code> (% ou
                  fração), <code>descricao</code>, <code>observacoes</code>
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Aba Ficha_Tecnica</p>
                <p className="mt-0.5">
                  Colunas: <code>produto</code>, <code>ingrediente</code>,{" "}
                  <code>quantidade</code>, <code>observacoes</code>. Cada linha
                  é um item; agrupado por <code>produto</code>.
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Aba Combos</p>
                <p className="mt-0.5">
                  Colunas: <code>nome</code>, <code>categoria</code>,{" "}
                  <code>preco_venda</code>, <code>meta_cmv</code>,{" "}
                  <code>descricao</code>
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Aba Combo_Itens</p>
                <p className="mt-0.5">
                  Colunas: <code>combo</code>, <code>produto</code>,{" "}
                  <code>quantidade</code>
                </p>
              </div>
              <p className="text-slate-400 text-[11px] pt-2 border-t border-slate-100">
                Nomes de colunas e abas são case/acento-insensitive. Aliases
                comuns são reconhecidos (ex.: <code>preco</code>,{" "}
                <code>custo</code>, <code>qty</code>).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Importações recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-xs text-slate-500">Sem histórico ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-slate-700 truncate">
                          {r.fileName}
                        </span>
                        <Badge
                          tone={
                            r.status === "SUCESSO"
                              ? "success"
                              : r.status === "PARCIAL"
                                ? "warning"
                                : r.status === "FALHA"
                                  ? "danger"
                                  : "neutral"
                          }
                        >
                          {IMPORT_STATUS_LABEL[r.status]}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-slate-500">
                        {formatDateTime(r.importedAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
