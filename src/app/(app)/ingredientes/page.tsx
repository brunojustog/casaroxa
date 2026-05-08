import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { IngredientFilters } from "@/components/ingredients/IngredientFilters";
import { IngredientRowActions } from "@/components/ingredients/IngredientRowActions";
import { listIngredients } from "@/server/services/ingredient.service";
import {
  ingredientListFiltersSchema,
} from "@/schemas/ingredient.schema";
import {
  INGREDIENT_CATEGORY_LABEL,
  INGREDIENT_UNIT_LABEL,
} from "@/lib/enums";
import { formatBRL, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function IngredientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = ingredientListFiltersSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    category: typeof params.category === "string" && params.category.length > 0 ? params.category : undefined,
    active: typeof params.active === "string" ? params.active : "active",
  });

  const ingredients = await listIngredients(filters);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ingredientes"
        description="Cadastro de insumos e ingredientes. Mudanças de preço recalculam fichas e combos automaticamente."
        actions={
          <Link
            href="/ingredientes/novo"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-roxa-700 px-4 text-sm font-medium text-white hover:bg-roxa-800"
          >
            <Plus className="h-4 w-4" />
            Novo ingrediente
          </Link>
        }
      />

      <IngredientFilters />

      {ingredients.length === 0 ? (
        <EmptyState>
          Nenhum ingrediente encontrado com esses filtros.{" "}
          <Link href="/ingredientes/novo" className="text-roxa-700 hover:underline">
            Cadastrar o primeiro
          </Link>
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nome</TH>
              <TH>Categoria</TH>
              <TH>Unidade</TH>
              <TH className="text-right">Custo unit.</TH>
              <TH>Fornecedor</TH>
              <TH>Atualizado</TH>
              <TH>Status</TH>
              <TH className="text-right pr-4">Ações</TH>
            </TR>
          </THead>
          <TBody>
            {ingredients.map((ing) => (
              <TR key={ing.id}>
                <TD className="font-medium text-slate-900">
                  <Link href={`/ingredientes/${ing.id}`} className="hover:text-roxa-700">
                    {ing.name}
                  </Link>
                </TD>
                <TD>{INGREDIENT_CATEGORY_LABEL[ing.category]}</TD>
                <TD>{INGREDIENT_UNIT_LABEL[ing.unit]}</TD>
                <TD className="text-right tabular-nums">{formatBRL(ing.unitCost)}</TD>
                <TD className="text-slate-500">{ing.supplier ?? "—"}</TD>
                <TD className="text-slate-500 text-xs">{formatDate(ing.lastPriceAt)}</TD>
                <TD>
                  {ing.active ? (
                    <Badge tone="success">Ativo</Badge>
                  ) : (
                    <Badge tone="neutral">Inativo</Badge>
                  )}
                </TD>
                <TD className="text-right pr-2">
                  <IngredientRowActions id={ing.id} active={ing.active} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <div className="text-xs text-slate-500">
        {ingredients.length} ingrediente{ingredients.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
