"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Save } from "lucide-react";
import { SaleProgress } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SALE_PROGRESS_LABEL,
  SALE_PROGRESS_ORDER,
} from "@/lib/enums";
import { setSaleProgressAction } from "@/server/actions/sales";

/**
 * Controle de etapa do pedido (admin). Mostra a sequência de SaleProgress
 * como botões clicáveis + estimativa de tempo opcional.
 *
 * Compacto: cabe no card de detalhe da venda em /vendas/[id].
 */
export function SaleProgressBar({
  saleId,
  current,
  estimateMinutes,
}: {
  saleId: string;
  current: SaleProgress;
  estimateMinutes: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<string>(
    estimateMinutes !== null ? String(estimateMinutes) : "",
  );

  function update(progress: SaleProgress) {
    setError(null);
    startTransition(async () => {
      const res = await setSaleProgressAction(saleId, {
        progress,
        estimateMinutes: estimate || null,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function saveEstimate() {
    setError(null);
    startTransition(async () => {
      const res = await setSaleProgressAction(saleId, {
        progress: current,
        estimateMinutes: estimate || null,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Etapas como chips */}
      <div className="flex flex-wrap gap-1.5">
        {SALE_PROGRESS_ORDER.map((step) => {
          const isCurrent = step === current;
          return (
            <button
              key={step}
              type="button"
              onClick={() => update(step)}
              disabled={pending || isCurrent}
              className={
                isCurrent
                  ? "rounded-full border-2 border-roxa-700 bg-roxa-50 px-3 py-1 text-xs font-semibold text-roxa-800"
                  : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-roxa-300 hover:bg-roxa-50 hover:text-roxa-700 disabled:opacity-50"
              }
              title={
                isCurrent
                  ? `Atual: ${SALE_PROGRESS_LABEL[step]}`
                  : `Avançar para: ${SALE_PROGRESS_LABEL[step]}`
              }
            >
              {SALE_PROGRESS_LABEL[step]}
            </button>
          );
        })}
      </div>

      {/* Estimativa de tempo */}
      <div className="flex items-end gap-2">
        <div className="flex-1 max-w-[200px]">
          <label className="text-[11px] text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Estimativa (min, opcional)
          </label>
          <Input
            type="number"
            min="0"
            step="1"
            value={estimate}
            onChange={(e) => setEstimate(e.currentTarget.value)}
            placeholder="ex: 30"
            disabled={pending}
            className="h-8 text-sm"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={saveEstimate}
          disabled={pending}
        >
          <Save className="h-3.5 w-3.5" />
          Salvar
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
