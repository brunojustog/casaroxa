"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setRecipeReviewedAction } from "@/server/actions/recipes";

export function RecipeReviewedToggle({
  productId,
  reviewed,
  recipeExists,
}: {
  productId: string;
  reviewed: boolean;
  recipeExists: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await setRecipeReviewedAction(productId, !reviewed);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  if (!recipeExists) {
    return (
      <span className="text-xs text-slate-400">
        Salve a ficha antes de marcar como revisada.
      </span>
    );
  }

  return reviewed ? (
    <Button variant="outline" size="sm" onClick={toggle} disabled={pending} title="Desmarcar como revisada">
      <X className="h-3 w-3" />
      Desmarcar revisão
    </Button>
  ) : (
    <Button size="sm" onClick={toggle} disabled={pending} title="Marcar como revisada">
      <Check className="h-3 w-3" />
      Marcar como revisada
    </Button>
  );
}
