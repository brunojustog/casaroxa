"use client";

import { useEffect, useState } from "react";
import { Sparkles, Check, X, Clock, CheckCircle2 } from "lucide-react";

type Action = {
  id: string;
  kind: string;
  summary: string;
  reasoning: string;
  status: "PENDING" | "EXECUTED" | "REJECTED";
  remainingMin: number;
};

const INITIAL: Action[] = [
  {
    id: "a1",
    kind: "CRIAR CUPOM",
    summary: "Cupom RECUPERA15 — 15% off, válido 30d, pra 12 detratores recentes",
    reasoning:
      "Identifiquei 12 clientes com NPS 0–6 nos últimos 30 dias. Cupom de retorno pode recuperar parte deles.",
    status: "PENDING",
    remainingMin: 23 * 60,
  },
  {
    id: "a2",
    kind: "AJUSTAR PREÇO",
    summary: "Frango Assado Inteiro: R$ 44,90 → R$ 49,90 (CMV está em 58%)",
    reasoning:
      "Após a última compra de frango, o CMV do produto subiu pra 58% — acima do target de 50%.",
    status: "PENDING",
    remainingMin: 21 * 60,
  },
];

export function AiApprovalsScreen() {
  const [actions, setActions] = useState<Action[]>(INITIAL);

  // Loop: aprovar a1, rejeitar a2, resetar
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, 4000));
        if (cancelled) return;
        setActions((prev) =>
          prev.map((a) =>
            a.id === "a1" && a.status === "PENDING"
              ? { ...a, status: "EXECUTED" }
              : a,
          ),
        );
        await new Promise((r) => setTimeout(r, 2500));
        if (cancelled) return;
        setActions((prev) =>
          prev.map((a) =>
            a.id === "a2" && a.status === "PENDING"
              ? { ...a, status: "REJECTED" }
              : a,
          ),
        );
        await new Promise((r) => setTimeout(r, 3500));
        if (cancelled) return;
        setActions(INITIAL.map((a) => ({ ...a })));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-slate-50 p-4 min-h-[420px]">
      <div className="mb-3 rounded-md border border-slate-200 bg-white p-3">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
          <Clock className="h-4 w-4 text-amber-500" />
          {actions.filter((a) => a.status === "PENDING").length}{" "}
          {actions.filter((a) => a.status === "PENDING").length === 1
            ? "ação pendente"
            : "ações pendentes"}{" "}
          de aprovação
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Aprovadas executam imediatamente — confira o payload antes.
        </p>
      </div>

      <ul className="space-y-2">
        {actions.map((a) => {
          const isPending = a.status === "PENDING";
          const isExecuted = a.status === "EXECUTED";
          const isRejected = a.status === "REJECTED";
          return (
            <li
              key={a.id}
              className={
                isPending
                  ? "rounded-lg border border-amber-200 bg-white shadow-sm"
                  : isExecuted
                    ? "rounded-lg border-2 border-green-300 bg-green-50 shadow-sm animate-fade-in"
                    : "rounded-lg border-2 border-red-200 bg-red-50/60 shadow-sm animate-fade-in"
              }
            >
              <div className="flex items-start gap-3 p-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-roxa-100 text-roxa-700">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={
                        isPending
                          ? "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800"
                          : isExecuted
                            ? "inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-800"
                            : "inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-800"
                      }
                    >
                      {isPending
                        ? "Pendente"
                        : isExecuted
                          ? "Executada ✓"
                          : "Rejeitada"}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {a.kind}
                    </span>
                    {isPending && (
                      <span className="text-[10px] text-amber-700">
                        Expira em {Math.floor(a.remainingMin / 60)}h
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-900">
                    {a.summary}
                  </p>
                  <p className="text-[11px] italic text-slate-600 mt-0.5">
                    &ldquo;{a.reasoning}&rdquo;
                  </p>
                </div>
                {isPending && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-[10px] font-semibold text-white">
                      <Check className="h-3 w-3" /> Aprovar
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-[10px] font-medium text-red-700">
                      <X className="h-3 w-3" /> Rejeitar
                    </button>
                  </div>
                )}
                {isExecuted && (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
