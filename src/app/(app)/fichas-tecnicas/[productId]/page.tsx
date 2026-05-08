import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, History } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RecipeEditor,
  type EditorIngredient,
  type EditorItem,
} from "@/components/recipes/RecipeEditor";
import { RecipeReviewedToggle } from "@/components/recipes/RecipeReviewedToggle";
import {
  getActiveIngredients,
  getRecipeForProduct,
} from "@/server/services/recipe.service";
import {
  PRODUCT_CATEGORY_LABEL,
  PRODUCT_TYPE_LABEL,
} from "@/lib/enums";
import { formatBRL, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FichaTecnicaPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  const [productWithRecipe, ingredients] = await Promise.all([
    getRecipeForProduct(productId),
    getActiveIngredients(),
  ]);

  if (!productWithRecipe) notFound();

  const recipe = productWithRecipe.recipe;

  const initialItems: EditorItem[] =
    recipe?.items.map((it) => ({
      key: it.id,
      ingredientId: it.ingredientId,
      quantity: String(Number(it.quantity)),
      notes: it.notes ?? "",
    })) ?? [];

  const editorIngredients: EditorIngredient[] = ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    unit: i.unit,
    unitCost: Number(i.unitCost),
  }));

  return (
    <div className="space-y-5">
      <Link
        href="/fichas-tecnicas"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar para fichas técnicas
      </Link>

      <PageHeader
        title={`Ficha: ${productWithRecipe.name}`}
        description={[
          PRODUCT_CATEGORY_LABEL[productWithRecipe.category],
          PRODUCT_TYPE_LABEL[productWithRecipe.type],
          productWithRecipe.portionLabel,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            {recipe?.reviewed ? (
              <Badge tone="success">
                Revisada{" "}
                {recipe.reviewedBy?.name && `por ${recipe.reviewedBy.name}`}
                {recipe.reviewedAt && ` em ${formatDateTime(recipe.reviewedAt)}`}
              </Badge>
            ) : recipe ? (
              <Badge tone="warning">Não revisada</Badge>
            ) : null}
            <RecipeReviewedToggle
              productId={productWithRecipe.id}
              reviewed={recipe?.reviewed ?? false}
              recipeExists={!!recipe}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <RecipeEditor
            productId={productWithRecipe.id}
            productName={productWithRecipe.name}
            productSalePrice={
              productWithRecipe.salePrice ? Number(productWithRecipe.salePrice) : null
            }
            productTargetCmv={
              productWithRecipe.targetCmv ? Number(productWithRecipe.targetCmv) : null
            }
            initialItems={initialItems}
            initialResponsible={recipe?.responsible ?? ""}
            initialRecipeNotes={recipe?.notes ?? ""}
            ingredients={editorIngredients}
            recipeExists={!!recipe}
          />
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-slate-500" />
                Versões salvas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!recipe || recipe.versions.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhuma versão salva ainda. Use “Salvar versão” no editor antes de
                  alterações grandes.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recipe.versions.map((v) => {
                    const snap = v.snapshot as {
                      totalCost?: number;
                      items?: { ingredientName: string }[];
                    };
                    return (
                      <li
                        key={v.id}
                        className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold">v{v.version}</span>
                          <span className="text-slate-500">
                            {formatDateTime(v.createdAt)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-slate-500">
                          {snap.items?.length ?? 0} ingredientes ·{" "}
                          {snap.totalCost !== undefined ? formatBRL(snap.totalCost) : "—"}
                        </div>
                        {v.notes && (
                          <p className="mt-1 text-slate-600 italic">“{v.notes}”</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Como funciona</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-2">
              <p>
                Edite a tabela à esquerda. O custo, CMV e lucro recalculam em tempo
                real.
              </p>
              <p>
                Clique em <strong>Salvar ficha</strong> para persistir. Ao salvar:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>O custo do produto é atualizado</li>
                <li>Combos que usam este produto são recalculados</li>
                <li>A flag “revisada” é zerada (precisa marcar de novo)</li>
              </ul>
              <p className="pt-2">
                <strong>Salvar versão</strong> guarda um snapshot do estado atual antes
                de mudanças grandes.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
