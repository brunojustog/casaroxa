"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartProvider";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function CartIndicator() {
  const { count, total, hydrated } = useCart();
  // Esconde até hidratar pra evitar mismatch SSR
  const visibleCount = hydrated ? count : 0;
  const hasItems = visibleCount > 0;

  if (!hasItems) {
    return (
      <Link
        href="/checkout"
        className="relative inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-roxa-800 hover:bg-roxa-100"
        aria-label="Carrinho vazio"
      >
        <ShoppingBag className="h-5 w-5" />
      </Link>
    );
  }

  return (
    <Link
      href="/checkout"
      className="relative inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
      aria-label={`Finalizar pedido — ${visibleCount} ${visibleCount === 1 ? "item" : "itens"}, ${fmt(total)}`}
    >
      <span className="relative">
        <ShoppingBag className="h-5 w-5" />
        <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-green-700 shadow ring-1 ring-green-200">
          {visibleCount}
        </span>
      </span>
      <span className="hidden sm:inline">
        Finalizar · <span className="tabular-nums">{fmt(total)}</span>
      </span>
    </Link>
  );
}
