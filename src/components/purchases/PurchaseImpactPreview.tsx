import { TrendingDown, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { IngredientImpact } from "@/server/services/purchase-impact.service";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

const fmtPct = (v: number) =>
  `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`;

const fmtCmv = (v: number) =>
  `${(v * 100).toFixed(0)}%`;

export function PurchaseImpactPreview({
  impacts,
}: {
  impacts: IngredientImpact[];
}) {
  if (impacts.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 flex items-start gap-2 text-sm text-slate-600">
          <Info className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
          <p>
            Nenhum ingrediente desta compra vai atualizar o custo cadastrado
            (todos com &ldquo;atualizar custo&rdquo; desligado, ou preço igual
            ao atual).
          </p>
        </CardContent>
      </Card>
    );
  }

  const anyOverTarget = impacts.some((i) =>
    i.affectedProducts.some((p) => p.overTarget),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="h-4 w-4 text-roxa-700" />
          Impacto se confirmar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {anyOverTarget && (
          <div className="flex items-start gap-2 rounded-md border-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Alguns produtos vão ficar com CMV acima do target. Considere
              reajustar o preço de venda — sugestão no detalhe abaixo.
            </p>
          </div>
        )}

        {impacts.map((imp) => {
          const isUp = imp.newUnitCost > imp.oldUnitCost;
          return (
            <section
              key={imp.ingredientId}
              className="rounded-md border border-slate-200 bg-white"
            >
              <header className="border-b border-slate-100 px-3 py-2 flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">
                  {imp.ingredientName}
                </p>
                <span
                  className={
                    isUp
                      ? "inline-flex items-center gap-1 text-xs font-bold text-red-700"
                      : "inline-flex items-center gap-1 text-xs font-bold text-green-700"
                  }
                >
                  {isUp ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {fmtBRL(imp.oldUnitCost)} → {fmtBRL(imp.newUnitCost)} (
                  {fmtPct(imp.deltaPct)})
                </span>
              </header>
              {imp.affectedProducts.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-500">
                  Nenhum produto ativo usa esse ingrediente em ficha técnica.
                </p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {imp.affectedProducts.map((p) => (
                    <li key={p.productId} className="px-3 py-2 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">
                            {p.productName}
                          </p>
                          <p className="text-[11px] text-slate-600 tabular-nums">
                            Custo: {fmtBRL(p.oldTotalCost)} →{" "}
                            <strong>{fmtBRL(p.newTotalCost)}</strong>{" "}
                            ({fmtPct(p.costDeltaPct)})
                            {p.salePrice > 0 && (
                              <>
                                {" · CMV: "}
                                {fmtCmv(p.currentCmv)} →{" "}
                                <strong>{fmtCmv(p.newCmv)}</strong>
                                {" (alvo "}
                                {fmtCmv(p.targetCmv)}
                                {")"}
                              </>
                            )}
                          </p>
                        </div>
                        {p.overTarget ? (
                          <div className="text-right shrink-0">
                            <Badge tone="warning" className="text-[10px]">
                              Acima do target
                            </Badge>
                            {p.suggestedSalePrice && (
                              <p className="mt-1 text-[11px] text-amber-800">
                                Sugestão: <strong>{fmtBRL(p.suggestedSalePrice)}</strong>
                                <br />
                                (atual {fmtBRL(p.salePrice)})
                              </p>
                            )}
                          </div>
                        ) : p.salePrice > 0 ? (
                          <Badge tone="success" className="text-[10px]">
                            OK
                          </Badge>
                        ) : (
                          <Badge tone="neutral" className="text-[10px]">
                            Sem preço
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        <p className="text-[11px] text-slate-500 italic">
          Cascata real (combos, fichas dependentes) é aplicada ao confirmar a
          compra. Este preview mostra só o impacto direto pra dar ordem de
          grandeza.
        </p>
      </CardContent>
    </Card>
  );
}
