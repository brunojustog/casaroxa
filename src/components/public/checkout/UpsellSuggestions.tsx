"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImageOff, Plus, Sparkles } from "lucide-react";
import { useCart } from "@/components/public/cart/CartProvider";

type Suggestion = {
  id: string;
  kind: "PRODUTO";
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  category: string;
  reason: string;
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

export function UpsellSuggestions() {
  const { cart, add } = useCart();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (cart.items.length === 0) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const payload = {
      items: cart.items.map((i) => ({ id: i.id, kind: i.kind })),
    };
    fetch("/api/public/upsells", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok) setSuggestions(d.suggestions ?? []);
      })
      .catch(() => {
        /* fire-and-forget */
      });
    return () => {
      cancelled = true;
    };
  }, [cart.items]);

  if (suggestions.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
      <h2 className="font-serif text-base font-semibold text-amber-900 inline-flex items-center gap-1.5">
        <Sparkles className="h-4 w-4" />
        Que tal completar?
      </h2>
      <p className="text-xs text-amber-800 mt-0.5">
        Pra ficar redondo, esses items combinam com o que você escolheu.
      </p>
      <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-2 rounded-md border border-amber-200 bg-white p-2"
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-amber-50">
              {s.imageUrl ? (
                <Image
                  src={s.imageUrl}
                  alt={s.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-amber-300">
                  <ImageOff className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">
                {s.name}
              </p>
              <p className="text-[11px] tabular-nums text-roxa-700 font-semibold">
                {fmt(s.price)}
              </p>
              <p className="text-[10px] text-amber-700">{s.reason}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                add({
                  id: s.id,
                  kind: s.kind,
                  name: s.name,
                  price: s.price,
                  imageUrl: s.imageUrl,
                })
              }
              className="rounded-md bg-amber-600 p-2 text-white hover:bg-amber-700"
              aria-label={`Adicionar ${s.name}`}
              title="Adicionar"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
