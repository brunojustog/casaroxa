"use client";

import { useEffect, useState } from "react";
import {
  Check,
  X,
  Phone,
  Calendar,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

type Status = "PENDENTE" | "APROVADA" | "EM_PRODUCAO" | "PRONTA" | "ENTREGUE";

const FLOW: Status[] = ["PENDENTE", "APROVADA", "EM_PRODUCAO", "PRONTA", "ENTREGUE"];

const STATUS_TONE: Record<Status, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  APROVADA: "bg-blue-100 text-blue-800",
  EM_PRODUCAO: "bg-blue-100 text-blue-800",
  PRONTA: "bg-green-100 text-green-800",
  ENTREGUE: "bg-green-100 text-green-800",
};

export function EncomendaAdminScreen() {
  const [status, setStatus] = useState<Status>("PENDENTE");

  // Loop pelos status
  useEffect(() => {
    let cancelled = false;
    const advance = async () => {
      while (!cancelled) {
        for (const s of FLOW) {
          await new Promise((r) => setTimeout(r, 2500));
          if (cancelled) return;
          setStatus(s);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    };
    advance();
    return () => {
      cancelled = true;
    };
  }, []);

  const isPending = status === "PENDENTE";
  const nextAction = {
    APROVADA: "Iniciar produção",
    EM_PRODUCAO: "Marcar como pronta",
    PRONTA: "Marcar como entregue",
  }[status as "APROVADA" | "EM_PRODUCAO" | "PRONTA"];

  return (
    <div className="bg-slate-50 p-4 space-y-3 min-h-[420px]">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-base font-bold text-slate-900">
            Encomenda ER-7
          </h2>
          <p className="text-[10px] text-slate-500">
            Criada via site · 14/05/2026 10:32
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[status]}`}
        >
          {status === "EM_PRODUCAO" ? "Produzindo" : status}
        </span>
      </header>

      {/* Action bar */}
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
          Ações
        </span>
        {isPending && (
          <>
            <button className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-[10px] font-semibold text-white animate-pulse-ring">
              <Check className="h-3 w-3" /> Aprovar
            </button>
            <button className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-[10px] font-medium text-red-700">
              <X className="h-3 w-3" /> Recusar
            </button>
          </>
        )}
        {!isPending && status !== "ENTREGUE" && nextAction && (
          <button className="inline-flex items-center gap-1 rounded-md bg-roxa-700 px-2.5 py-1 text-[10px] font-semibold text-white animate-pulse-ring">
            <Sparkles className="h-3 w-3" /> {nextAction}
          </button>
        )}
        {status === "ENTREGUE" && (
          <span className="text-[10px] text-green-700 font-medium">
            ✓ Sale CONCLUIDA — encomenda fechada
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-slate-200 bg-white p-2">
          <p className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
            <Phone className="h-2.5 w-2.5" /> Cliente
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-900">João Silva</p>
          <p className="text-[10px] text-slate-600">(14) 99999-1234</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-2">
          <p className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
            <Calendar className="h-2.5 w-2.5" /> Para quando
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-900">
            Sáb 17/05 · 14:00
          </p>
          <p className="text-[10px] text-slate-600">🛍 Retirada no local</p>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-2">
        <p className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
          <ShoppingBag className="h-2.5 w-2.5" /> Itens
        </p>
        <ul className="mt-1.5 space-y-0.5 text-xs text-slate-700">
          <li className="flex justify-between">
            <span>2× Combo Costela Casal</span>
            <span className="tabular-nums">R$ 399,80</span>
          </li>
          <li className="flex justify-between">
            <span>1× Refrigerante 2L</span>
            <span className="tabular-nums">R$ 12,00</span>
          </li>
          <li className="flex justify-between pt-1.5 border-t border-slate-100 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">R$ 411,80</span>
          </li>
        </ul>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-2 text-[10px] text-slate-600">
        💳 Sinal: R$ 50,00 (aguardando pagamento via Asaas)
      </div>
    </div>
  );
}
