"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartProvider";

export function CartIndicator() {
  const { count, hydrated } = useCart();
  // Esconde até hidratar pra evitar mismatch SSR
  const visibleCount = hydrated ? count : 0;

  return (
    <Link
      href="/checkout"
      className="relative inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-roxa-800 hover:bg-roxa-100"
      aria-label={`Carrinho com ${visibleCount} ${visibleCount === 1 ? "item" : "itens"}`}
    >
      <ShoppingBag className="h-5 w-5" />
      {visibleCount > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-roxa-700 px-1.5 text-[10px] font-bold text-white shadow">
          {visibleCount}
        </span>
      )}
    </Link>
  );
}
