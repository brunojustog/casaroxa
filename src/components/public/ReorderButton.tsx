"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Repeat } from "lucide-react";
import { useCart } from "@/components/public/cart/CartProvider";

type Variant = "list" | "block";

type ReorderResponse =
  | {
      ok: true;
      saleNumber: number;
      items: Array<{
        id: string;
        kind: "PRODUTO" | "COMBO";
        name: string;
        price: number;
        imageUrl: string | null;
        quantity: number;
        requiresKitchen: boolean;
      }>;
      unavailable: Array<{ name: string; reason: string }>;
    }
  | { ok: false; error: string };

/**
 * Botão "Pedir novamente" — pega items da Sale via API, monta carrinho
 * (substituindo o atual) e leva pro /checkout. Avisa se algum item
 * estiver fora do cardápio agora.
 */
export function ReorderButton({
  saleId,
  variant = "list",
  onBeforeNavigate,
}: {
  saleId: string;
  variant?: Variant;
  onBeforeNavigate?: () => void;
}) {
  const router = useRouter();
  const { clear, add, setQty } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/public/reorder/${saleId}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as ReorderResponse;
      if (!data.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }
      if (data.items.length === 0) {
        const list = data.unavailable.map((u) => `• ${u.name} (${u.reason})`).join("\n");
        window.alert(
          `Nenhum item desse pedido está disponível agora.\n\n${list || "Tente outro pedido ou volte ao cardápio."}`,
        );
        setLoading(false);
        return;
      }
      if (data.unavailable.length > 0) {
        const list = data.unavailable.map((u) => `• ${u.name} (${u.reason})`).join("\n");
        const ok = window.confirm(
          `Alguns items não estão mais disponíveis e serão pulados:\n\n${list}\n\nAdicionar o resto ao carrinho?`,
        );
        if (!ok) {
          setLoading(false);
          return;
        }
      }

      // Limpa carrinho atual e adiciona os items
      clear();
      for (const it of data.items) {
        add({
          id: it.id,
          kind: it.kind,
          name: it.name,
          price: it.price,
          imageUrl: it.imageUrl,
          requiresKitchen: it.requiresKitchen,
        });
        if (it.quantity > 1) {
          setQty(`${it.kind}:${it.id}`, it.quantity);
        }
      }

      onBeforeNavigate?.();
      router.push("/checkout");
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  if (variant === "block") {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-roxa-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-roxa-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Repeat className="h-4 w-4" />
          )}
          {loading ? "Montando carrinho…" : "Pedir novamente"}
        </button>
        {error && (
          <p className="text-xs text-red-600 text-center">{error}</p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title="Adicionar os mesmos items ao carrinho"
      className="inline-flex items-center gap-1 rounded-md border border-roxa-200 bg-white px-2.5 py-1 text-[11px] font-medium text-roxa-700 hover:bg-roxa-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Repeat className="h-3 w-3" />
      )}
      Pedir de novo
    </button>
  );
}
