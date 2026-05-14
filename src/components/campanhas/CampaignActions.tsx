"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { CampaignStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  deleteCampaignAction,
  dispatchCampaignAction,
} from "@/server/actions/campaigns";

export function CampaignActions({
  campaignId,
  status,
  audienceCount,
}: {
  campaignId: string;
  status: CampaignStatus;
  audienceCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    sent: number;
    failed: number;
    skipped: number;
  } | null>(null);

  function dispatch() {
    if (
      !window.confirm(
        `Disparar a campanha pra ${audienceCount} cliente(s) agora? Pode levar alguns minutos (10s entre cada mensagem pra evitar ban do WhatsApp).`,
      )
    )
      return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await dispatchCampaignAction(campaignId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data ?? null);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Excluir esta campanha? Não pode ser desfeito.")) return;
    startTransition(async () => {
      const res = await deleteCampaignAction(campaignId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/campanhas");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <span className="text-xs uppercase tracking-wider text-slate-500 mr-1">
          Ações
        </span>

        {status === "DRAFT" && (
          <Button type="button" size="sm" onClick={dispatch} disabled={pending}>
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {pending ? "Disparando…" : "Disparar agora"}
          </Button>
        )}

        {status === "DISPATCHING" && (
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Disparo em andamento — atualize a página em alguns minutos.
          </span>
        )}

        {status === "DRAFT" && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Disparo concluído: <strong>{result.sent}</strong> enviadas,{" "}
          <strong>{result.failed}</strong> falhas,{" "}
          <strong>{result.skipped}</strong> puladas.
        </p>
      )}
    </div>
  );
}
