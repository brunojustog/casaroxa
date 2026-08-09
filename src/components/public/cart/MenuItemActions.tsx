"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { AddToCartButton } from "./AddToCartButton";
import { useCart } from "./CartProvider";

/**
 * Combina o botão "Adicionar" com um atalho "Ir ao carrinho" que aparece
 * apenas quando há itens no carrinho. Visível em cada MenuItemCard pra
 * facilitar a transição cardápio → checkout sem precisar abrir o header.
 */
export function MenuItemActions({
  item,
}: {
  item: {
    id: string;
    kind: "PRODUTO" | "COMBO";
    name: string;
    price: number;
    imageUrl: string | null;
    requiresKitchen: boolean;
  };
}) {
  const { count, hydrated } = useCart();
  const showCartShortcut = hydrated && count > 0;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <AddToCartButton item={item} />
      {showCartShortcut && (
        <Link
          href="/checkout"
          className="relative inline-flex items-center justify-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
          aria-label={`Ir ao carrinho (${count} ${count === 1 ? "item" : "itens"})`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">Ir ao carrinho</span>
          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-green-700">
            {count}
          </span>
        </Link>
      )}
    </div>
  );
}
