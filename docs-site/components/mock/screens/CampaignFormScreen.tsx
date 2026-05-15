"use client";

import { useEffect, useState } from "react";
import { Users, Loader2, Tag } from "lucide-react";

type Audience = {
  key: string;
  label: string;
  description: string;
  count: number;
  sample: string[];
};

const AUDIENCES: Audience[] = [
  {
    key: "INACTIVE_30D",
    label: "Inativos há 30 dias",
    description: "Pedido confirmado antes, nenhum nos últimos 30 dias",
    count: 47,
    sample: ["João Silva", "Maria Lemos", "Pedro M."],
  },
  {
    key: "RECURRING",
    label: "Recorrentes (3+ pedidos)",
    description: "Clientes com 3+ pedidos concluídos",
    count: 18,
    sample: ["Ana Costa", "Carlos R.", "Júlia P."],
  },
  {
    key: "DETRACTORS_30D",
    label: "Detratores (NPS)",
    description: "Nota 0-6 nos últimos 30 dias",
    count: 8,
    sample: ["Rita F.", "Bruno N.", "Sofia L."],
  },
  {
    key: "PROMOTERS_30D",
    label: "Promotores (NPS)",
    description: "Nota 9-10 nos últimos 30 dias",
    count: 32,
    sample: ["Helena P.", "Ricardo S.", "Luiza M."],
  },
];

export function CampaignFormScreen() {
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);

  // Loop pelas audiências
  useEffect(() => {
    let cancelled = false;
    const cycle = async () => {
      while (!cancelled) {
        for (let i = 0; i < AUDIENCES.length; i++) {
          setLoading(true);
          await new Promise((r) => setTimeout(r, 400));
          if (cancelled) return;
          setSelected(i);
          setLoading(false);
          await new Promise((r) => setTimeout(r, 2800));
          if (cancelled) return;
        }
      }
    };
    cycle();
    return () => {
      cancelled = true;
    };
  }, []);

  const audience = AUDIENCES[selected];

  return (
    <div className="bg-slate-50 p-4 min-h-[420px] space-y-3">
      <h2 className="font-serif text-base font-bold text-slate-900">
        Nova campanha
      </h2>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Audiência
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {AUDIENCES.map((a, i) => (
            <label
              key={a.key}
              className={
                i === selected
                  ? "rounded-md border-2 border-roxa-500 bg-roxa-50/60 p-2 transition-all"
                  : "rounded-md border border-slate-200 bg-white p-2 transition-all"
              }
            >
              <div className="flex items-start gap-1.5">
                <input
                  type="radio"
                  checked={i === selected}
                  readOnly
                  className="mt-0.5 h-3 w-3 accent-roxa-700"
                />
                <div>
                  <p
                    className={
                      i === selected
                        ? "text-[10px] font-semibold text-roxa-900"
                        : "text-[10px] font-medium text-slate-700"
                    }
                  >
                    {a.label}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">
                    {a.description}
                  </p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 inline-flex items-center gap-2 text-sm">
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
            <span className="text-slate-500 text-xs">
              Calculando audiência…
            </span>
          </>
        ) : (
          <>
            <Users className="h-3.5 w-3.5 text-roxa-700" />
            <span className="text-xs font-semibold text-slate-900 tabular-nums">
              {audience.count}
            </span>
            <span className="text-xs text-slate-600">
              clientes elegíveis · {audience.sample.join(", ")}…
            </span>
          </>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          <Tag className="h-2.5 w-2.5" /> Cupom (opcional)
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          <input
            readOnly
            value="MAIO15"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-mono uppercase"
          />
          <select
            disabled
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            <option>%</option>
          </select>
          <input
            readOnly
            value="15"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          />
          <input
            readOnly
            value="30 dias"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          />
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
          Mensagem
        </p>
        <p className="text-xs text-slate-700 leading-relaxed font-mono">
          Olá, {"{nome}"}! 👋 A Casa Roxa preparou uma novidade pra você. Use o
          cupom *{"{cupom}"}* no próximo pedido.
        </p>
      </div>
    </div>
  );
}
