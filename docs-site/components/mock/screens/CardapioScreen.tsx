"use client";

import { Flame, PiggyBank, ImageOff, Plus } from "lucide-react";

type Item = {
  name: string;
  category: string;
  price: number;
  savings?: number;
  topPick?: boolean;
  isCombo?: boolean;
};

const ITEMS: Item[] = [
  {
    name: "Combo Costela Casal",
    category: "Combos",
    price: 199.9,
    savings: 30,
    topPick: true,
    isCombo: true,
  },
  {
    name: "Combo Domingão",
    category: "Combos",
    price: 159.9,
    savings: 15,
    isCombo: true,
  },
  {
    name: "Frango Assado Inteiro",
    category: "Frangos",
    price: 49.9,
    topPick: true,
  },
  {
    name: "Frango Crocante",
    category: "Frangos",
    price: 54.9,
  },
];

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

export function CardapioScreen() {
  // Agrupa por categoria mantendo ordem dos items
  const grouped = ITEMS.reduce<Record<string, Item[]>>((acc, it) => {
    (acc[it.category] = acc[it.category] ?? []).push(it);
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-5">
      <header>
        <h2 className="font-serif text-2xl font-bold text-roxa-900">Cardápio</h2>
        <p className="text-xs text-slate-600 mt-0.5">
          4 itens disponíveis · pedido mínimo R$ 30,00
        </p>
      </header>

      {Object.entries(grouped).map(([cat, items]) => (
        <section key={cat}>
          <h3 className="font-serif text-base font-bold text-roxa-900 mb-2">
            {cat}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((it) => (
              <article
                key={it.name}
                className="overflow-hidden rounded-lg border border-roxa-100 bg-white shadow-sm"
              >
                <div className="relative aspect-[5/3] bg-roxa-50 grid place-items-center text-roxa-300">
                  <ImageOff className="h-6 w-6" />
                  {it.isCombo && (
                    <span className="absolute left-2 top-2 rounded-full bg-roxa-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      Combo
                    </span>
                  )}
                  {it.topPick && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white animate-pulse-ring">
                      <Flame className="h-2.5 w-2.5" />
                      Mais pedido
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-serif text-sm font-semibold text-roxa-900">
                    {it.name}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-bold tabular-nums text-roxa-700">
                        {fmt(it.price)}
                      </p>
                      {it.savings && (
                        <p className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700">
                          <PiggyBank className="h-2.5 w-2.5" />
                          Economize {fmt(it.savings)}
                        </p>
                      )}
                    </div>
                    <button className="inline-flex items-center gap-1 rounded-md bg-roxa-700 px-2.5 py-1 text-[10px] font-semibold text-white">
                      <Plus className="h-3 w-3" /> Adicionar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
