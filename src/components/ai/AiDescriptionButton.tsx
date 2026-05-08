"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { generateDescriptionAction } from "@/server/actions/ai-description";

export function AiDescriptionButton({
  kind,
  id,
  onResult,
  disabled,
}: {
  kind: "PRODUTO" | "COMBO";
  /** ID do produto/combo. Se ausente, o botão fica desabilitado (precisa salvar antes). */
  id: string | null;
  onResult: (description: string) => void;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canRun = !!id && !disabled && !pending;

  function generate() {
    if (!id) return;
    setError(null);
    startTransition(async () => {
      const res = await generateDescriptionAction({ kind, id });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data) onResult(res.data.description);
    });
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={generate}
        disabled={!canRun}
        title={
          !id
            ? "Salve o produto pelo menos uma vez antes de gerar com IA"
            : "Gerar descrição com IA"
        }
        className="inline-flex items-center gap-1.5 rounded-md border border-roxa-200 bg-roxa-50 px-2.5 py-1 text-xs font-medium text-roxa-800 hover:bg-roxa-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        {pending ? "Gerando…" : "Gerar com IA"}
      </button>
      {error && (
        <p className="text-[11px] text-red-600">{error}</p>
      )}
    </div>
  );
}
