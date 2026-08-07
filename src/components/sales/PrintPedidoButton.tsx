"use client";

import { useState } from "react";
import { ChefHat } from "lucide-react";

const AGENT_URL = "http://localhost:9123";

/**
 * Imprime o PAR do pedido de entrega na térmica: comanda da cozinha
 * (letra grande, sem preços) + cupom do entregador (endereço + cobrança).
 * Só funciona no computador do caixa (agente local); sem agente, avisa.
 */
export function PrintPedidoButton({ saleId }: { saleId: string }) {
  const [state, setState] = useState<"idle" | "printing" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function imprimir() {
    setState("printing");
    setMsg(null);
    try {
      const ping = await fetch(`${AGENT_URL}/ping`, {
        signal: AbortSignal.timeout(1500),
      });
      if (!ping.ok) throw new Error("agente");
    } catch {
      setState("err");
      setMsg("Impressora do caixa não encontrada — imprima pelo computador do caixa.");
      return;
    }
    try {
      for (const rota of ["comanda-texto", "cupom-texto"]) {
        const r = await fetch(`/api/pdv/${rota}/${saleId}`);
        if (!r.ok) throw new Error(`falha ao gerar ${rota}`);
        const text = await r.text();
        const p = await fetch(`${AGENT_URL}/print`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(60000),
        });
        const out = (await p.json()) as { ok: boolean; error?: string };
        if (!out.ok) throw new Error(out.error ?? "impressora não respondeu");
      }
      setState("ok");
      setMsg("✓ Comanda + cupom impressos!");
      setTimeout(() => setState("idle"), 4000);
    } catch (e) {
      setState("err");
      setMsg(`✗ ${e instanceof Error ? e.message : "erro ao imprimir"}`);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={imprimir}
        disabled={state === "printing"}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-roxa-400 hover:text-roxa-700 disabled:opacity-60"
      >
        <ChefHat className="h-4 w-4" />
        {state === "printing" ? "Imprimindo..." : "Imprimir pedido (2 vias)"}
      </button>
      {msg && (
        <span className={`text-xs ${state === "ok" ? "text-green-700" : "text-red-600"}`}>
          {msg}
        </span>
      )}
    </span>
  );
}
