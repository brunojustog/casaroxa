"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { useCart } from "./CartProvider";

export function AddToCartButton({
  item,
}: {
  item: {
    id: string;
    kind: "PRODUTO" | "COMBO";
    name: string;
    price: number;
    imageUrl: string | null;
  };
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    add(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={added}
      className={
        added
          ? "inline-flex items-center justify-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm"
          : "inline-flex items-center justify-center gap-1.5 rounded-md bg-roxa-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-roxa-800"
      }
    >
      {added ? (
        <>
          <Check className="h-4 w-4" />
          Adicionado
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" />
          Adicionar
        </>
      )}
    </button>
  );
}
