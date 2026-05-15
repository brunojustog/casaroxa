"use client";

import { ChefHat, ShoppingCart, Printer } from "lucide-react";

export function ProductionPlanScreen() {
  const prodList = [
    { name: "Frango Assado Inteiro", qty: 12, from: { pre: 8, enc: 4 } },
    { name: "Combo Costela Casal", qty: 6, from: { pre: 4, enc: 2 } },
    { name: "Combo Domingão", qty: 4, from: { pre: 4, enc: 0 } },
  ];

  const shopping = [
    { name: "Frango caipira", qty: "24 kg", cost: 696, sources: "12× Frango Assado" },
    { name: "Costela bovina", qty: "8 kg", cost: 480, sources: "6× Combo Costela" },
    { name: "Mandioca", qty: "10 kg", cost: 80, sources: "Combos" },
    { name: "Cebola", qty: "5 kg", cost: 25, sources: "Combos + Frangos" },
    { name: "Alho", qty: "1 kg", cost: 30, sources: "Frangos" },
  ];

  const total = shopping.reduce((a, s) => a + s.cost, 0);

  return (
    <div className="bg-slate-50 p-4 min-h-[420px] space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-base font-bold text-slate-900">
            Planejamento de produção
          </h2>
          <p className="text-[10px] text-slate-500">
            Pedidos confirmados para sábado, 17 de maio de 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value="2026-05-17"
            className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[10px]"
          />
          <button className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-700">
            <Printer className="h-2.5 w-2.5" /> Imprimir
          </button>
        </div>
      </header>

      <p className="text-[10px] text-slate-500">
        2 pré-venda(s) · 5 encomenda(s)
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-3 py-2">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700">
              <ChefHat className="h-3 w-3 text-roxa-700" /> Lista de produção
            </p>
          </header>
          <ul className="divide-y divide-slate-50 text-xs">
            {prodList.map((p) => (
              <li key={p.name} className="flex items-start gap-2 px-3 py-2">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded bg-roxa-100 text-[10px] font-bold text-roxa-800 tabular-nums">
                  {p.qty}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-[11px]">
                    {p.name}
                  </p>
                  <p className="text-[9px] text-slate-500">
                    {p.from.pre > 0 && `Pré-venda: ${p.from.pre}`}
                    {p.from.pre > 0 && p.from.enc > 0 && " · "}
                    {p.from.enc > 0 && `Encomenda: ${p.from.enc}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-3 py-2 flex items-center justify-between">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700">
              <ShoppingCart className="h-3 w-3 text-roxa-700" /> Lista de compras
            </p>
            <span className="text-[10px] font-normal text-slate-600 tabular-nums">
              R$ {total.toFixed(2)}
            </span>
          </header>
          <ul className="divide-y divide-slate-50 text-[10px]">
            {shopping.map((s) => (
              <li key={s.name} className="px-3 py-1.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="text-[9px] text-slate-500 truncate">
                      {s.sources}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 tabular-nums">
                      {s.qty}
                    </p>
                    <p className="text-[9px] text-slate-500 tabular-nums">
                      R$ {s.cost.toFixed(2)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
