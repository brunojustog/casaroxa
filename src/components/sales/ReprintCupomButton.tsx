"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

const AGENT_URL = "http://localhost:9123";

/**
 * Reimprime o cupom de uma venda: tenta a térmica via agente local e,
 * sem agente, abre a janelinha /pdv-cupom (diálogo do navegador).
 * O window.open do fallback só é automático quando a falha é imediata —
 * depois de esperar a impressora, o pop-up seria bloqueado, então nesse
 * caso vira um botão pro operador clicar.
 */
export function ReprintCupomButton({
  saleId,
  compact = false,
}: {
  saleId: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<"idle" | "printing" | "ok" | "err">("idle");

  function abrirCupomNavegador() {
    window.open(`/pdv-cupom/${saleId}`, "_blank", "width=320,height=640");
  }

  async function imprimir() {
    setState("printing");
    let agenteVivo = false;
    try {
      const ping = await fetch(`${AGENT_URL}/ping`, {
        signal: AbortSignal.timeout(1500),
      });
      agenteVivo = ping.ok;
    } catch {
      agenteVivo = false;
    }
    if (!agenteVivo) {
      abrirCupomNavegador();
      setState("idle");
      return;
    }
    try {
      const cupom = await fetch(`/api/pdv/cupom-texto/${saleId}`);
      if (!cupom.ok) throw new Error("cupom indisponível");
      const text = await cupom.text();
      const res = await fetch(`${AGENT_URL}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(60000),
      });
      const out = (await res.json()) as { ok: boolean };
      if (!out.ok) throw new Error("falha na impressora");
      setState("ok");
      setTimeout(() => setState("idle"), 4000);
    } catch {
      setState("err");
    }
  }

  if (state === "err") {
    return (
      <button
        type="button"
        onClick={() => {
          abrirCupomNavegador();
          setState("idle");
        }}
        title="Impressora não respondeu — clique pra abrir o cupom no navegador"
        className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
      >
        <Printer className="h-3.5 w-3.5" />
        Abrir cupom
      </button>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={imprimir}
        disabled={state === "printing"}
        title="Reimprimir cupom"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-roxa-700 disabled:opacity-50"
      >
        {state === "ok" ? (
          <span className="text-green-600">✓</span>
        ) : (
          <Printer className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={imprimir}
      disabled={state === "printing"}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-roxa-400 hover:text-roxa-700 disabled:opacity-60"
    >
      <Printer className="h-4 w-4" />
      {state === "printing"
        ? "Imprimindo..."
        : state === "ok"
          ? "✓ Impresso!"
          : "Reimprimir cupom"}
    </button>
  );
}
