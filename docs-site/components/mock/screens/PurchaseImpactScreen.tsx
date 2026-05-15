"use client";

import { AlertTriangle, Info, TrendingUp } from "lucide-react";
import { AdminShell } from "../AdminShell";
import { BrowserFrame } from "../BrowserFrame";

export function PurchaseImpactScreen() {
  return (
    <BrowserFrame
      url="gestao.casaroxa.com.br/compras/abc"
      caption="Antes de confirmar uma compra, sistema mostra qual ingrediente vai mudar, quais produtos serão afetados e se algum vai estourar o CMV target."
    >
      <AdminShell
        active="Compras"
        title="Compra #2347 (rascunho)"
        description="Fornecedor: Açougue Lima · 3 itens · R$ 487,00"
      >
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700">
              <Info className="h-3 w-3 text-roxa-700" />
              Impacto se confirmar
            </p>
          </div>

          <div className="p-3 space-y-2">
            <div className="flex items-start gap-1 rounded border-2 border-amber-300 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-900">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <p>
                Alguns produtos vão ficar com CMV acima do target. Considere
                reajustar o preço.
              </p>
            </div>

            <section className="rounded border border-slate-200">
              <header className="flex items-center justify-between border-b border-slate-100 px-2 py-1">
                <p className="text-[10px] font-bold text-slate-900">Costela bovina</p>
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-700">
                  <TrendingUp className="h-2.5 w-2.5" />
                  R$ 48,00 → R$ 52,00 (+8,3%)
                </span>
              </header>
              <ul className="text-[9px]">
                <li className="px-2 py-1 border-b border-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        Costela Premium 1kg
                      </p>
                      <p className="text-slate-600 tabular-nums">
                        Custo: R$ 59,40 → <strong>R$ 64,38</strong> (+8,4%) · CMV:
                        50% → <strong>54%</strong> (alvo 50%)
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block rounded-full bg-amber-100 px-1 py-0 text-[8px] font-bold text-amber-800">
                        Acima do target
                      </span>
                      <p className="mt-0.5 text-[8px] text-amber-800">
                        Sugestão: <strong>R$ 128,76</strong>
                        <br />
                        (atual R$ 119,00)
                      </p>
                    </div>
                  </div>
                </li>
                <li className="px-2 py-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        Combo Costela Casal
                      </p>
                      <p className="text-slate-600 tabular-nums">
                        Custo: R$ 118,80 → <strong>R$ 128,76</strong> (+8,4%)
                      </p>
                    </div>
                    <span className="inline-block rounded-full bg-green-100 px-1 py-0 text-[8px] font-bold text-green-800 shrink-0">
                      OK
                    </span>
                  </div>
                </li>
              </ul>
            </section>

            <button className="inline-flex items-center justify-center gap-1 rounded bg-green-600 px-3 py-1.5 text-[10px] font-semibold text-white w-full">
              Confirmar compra
            </button>
          </div>
        </div>
      </AdminShell>
    </BrowserFrame>
  );
}
