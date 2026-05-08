import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listProductsForRecipes } from "@/server/services/recipe.service";
import { recipeListFiltersSchema } from "@/schemas/recipe.schema";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/enums";
import { formatBRL, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FichasTecnicasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = recipeListFiltersSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    status: typeof params.status === "string" ? params.status : "all",
  });

  const products = await listProductsForRecipes(filters);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fichas Técnicas"
        description="Cada produto pode ter uma ficha técnica. Quando você altera o preço de um ingrediente, todas as fichas que o usam são recalculadas."
      />

      <FilterBar />

      {products.length === 0 ? (
        <EmptyState>Nenhum produto encontrado para esses filtros.</EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Produto</TH>
              <TH>Categoria</TH>
              <TH className="text-center">Itens</TH>
              <TH className="text-right">Custo</TH>
              <TH>Última edição</TH>
              <TH>Revisão</TH>
              <TH className="text-right pr-4">Editar</TH>
            </TR>
          </THead>
          <TBody>
            {products.map((p) => {
              const itemCount = p.recipe?._count.items ?? 0;
              const empty = !p.recipe || itemCount === 0;

              return (
                <TR key={p.id}>
                  <TD className="font-medium text-slate-900">{p.name}</TD>
                  <TD>{PRODUCT_CATEGORY_LABEL[p.category]}</TD>
                  <TD className="text-center text-slate-700 tabular-nums">
                    {empty ? <span className="text-slate-400">0</span> : itemCount}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {empty ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      formatBRL(p.recipe!.totalCost)
                    )}
                  </TD>
                  <TD className="text-slate-500 text-xs">
                    {p.recipe?.updatedAt ? formatDate(p.recipe.updatedAt) : "—"}
                  </TD>
                  <TD>
                    {empty ? (
                      <Badge tone="danger">Sem ficha</Badge>
                    ) : p.recipe?.reviewed ? (
                      <Badge tone="success">Revisada</Badge>
                    ) : (
                      <Badge tone="warning">Não revisada</Badge>
                    )}
                  </TD>
                  <TD className="text-right pr-2">
                    <Link
                      href={`/fichas-tecnicas/${p.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-roxa-700 hover:underline"
                    >
                      {empty ? "Criar ficha" : "Editar"}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {products.length} produto{products.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function FilterBar() {
  return (
    <form className="flex flex-wrap items-center gap-2" action="/fichas-tecnicas">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          name="search"
          placeholder="Buscar produto…"
          className="pl-8 w-72"
        />
      </div>
      <Select name="status" className="w-48" defaultValue="all">
        <option value="all">Todos</option>
        <option value="no_recipe">Sem ficha</option>
        <option value="needs_review">Não revisadas</option>
        <option value="reviewed">Revisadas</option>
      </Select>
      <button
        type="submit"
        className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
      >
        Filtrar
      </button>
    </form>
  );
}
