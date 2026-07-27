"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Power } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toggleCardapioAction } from "@/server/actions/settings";

/**
 * Chave rápida "cozinha online aberta/fechada" (cardápio).
 * Fechada: cardápio não aceita pedido pra agora; encomendas e empório
 * continuam funcionando normalmente.
 */
export function CardapioToggle({
  closed,
  message,
}: {
  closed: boolean;
  message: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState(message ?? "");

  function toggle(next: boolean) {
    startTransition(async () => {
      const res = await toggleCardapioAction(next, next ? msg : null);
      if (!res.ok) window.alert(res.error);
      router.refresh();
    });
  }

  return (
    <div
      className={`rounded-xl border-2 p-4 ${
        closed ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
            closed ? "bg-red-200 text-red-700" : "bg-green-200 text-green-700"
          }`}
        >
          <ChefHat className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Cozinha online:{" "}
            <span className={closed ? "text-red-700" : "text-green-700"}>
              {closed ? "FECHADA" : "ABERTA"}
            </span>
          </p>
          <p className="text-xs text-slate-600">
            {closed
              ? "O cardápio não aceita pedidos pra agora. Encomendas e empório seguem abertos."
              : "O cardápio está aceitando pedidos normalmente."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggle(!closed)}
          disabled={isPending}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 ${
            closed
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          <Power className="h-4 w-4" />
          {closed ? "Abrir cozinha" : "Fechar cozinha"}
        </button>
      </div>
      {!closed && (
        <div className="mt-3 flex items-center gap-2">
          <span className="shrink-0 text-xs text-slate-500">
            Mensagem ao fechar (opcional):
          </span>
          <Input
            value={msg}
            onChange={(e) => setMsg(e.currentTarget.value)}
            placeholder="Ex.: Voltamos sábado às 9h!"
            maxLength={300}
            className="h-8 flex-1 text-xs"
          />
        </div>
      )}
    </div>
  );
}
