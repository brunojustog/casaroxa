"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "./CartProvider";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Botão flutuante "Finalizar pedido" no rodapé das páginas públicas.
 * Aparece apenas no mobile (sm:hidden), com items no carrinho, e fora
 * da própria página /checkout (pra não duplicar com o botão da página).
 */
export function CartFloatingCta() {
  const pathname = usePathname();
  const { count, total, hydrated } = useCart();

  if (!hydrated) return null;
  if (count === 0) return null;
  if (pathname.startsWith("/checkout")) return null;

  return (
    <Link
      href="/checkout"
      className="fixed inset-x-4 bottom-4 z-30 inline-flex items-center justify-between gap-3 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-xl ring-4 ring-green-600/20 hover:bg-green-700 sm:hidden"
    >
      <span className="inline-flex items-center gap-2">
        <span className="relative">
          <ShoppingBag className="h-5 w-5" />
          <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-green-700 shadow">
            {count}
          </span>
        </span>
        <span>Finalizar pedido</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="tabular-nums">{fmt(total)}</span>
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
