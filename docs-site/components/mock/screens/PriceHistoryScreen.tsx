"use client";

import { History, TrendingUp, TrendingDown } from "lucide-react";

/**
 * Mockup do card de histórico de preço — sparkline SVG inline,
 * stats topo, lista de entradas com badge de %.
 */
export function PriceHistoryScreen() {
  const series = [22, 23, 22.5, 24, 26, 28, 27.5, 29];
  const W = 200;
  const H = 40;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const stepX = W / (series.length - 1);
  const points = series
    .map(
      (v, i) =>
        `${i * stepX},${H - ((v - min) / range) * (H - 4) - 2}`,
    )
    .join(" ");

  const entries = [
    { date: "14/05 09:12", old: 28, new: 29, delta: 3.6 },
    { date: "07/05 11:30", old: 27.5, new: 28, delta: 1.8 },
    { date: "30/04 14:45", old: 26, new: 27.5, delta: 5.8 },
    { date: "23/04 10:08", old: 24, new: 26, delta: 8.3 },
  ];

  return (
    <div className="bg-white p-4 min-h-[420px]">
      <header className="mb-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="h-4 w-4 text-slate-500" />
          Histórico de preço — Frango caipira (kg)
        </h3>
      </header>

      <div className="rounded-md border border-slate-100 bg-slate-50 p-3 max-w-xs">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-10"
          preserveAspectRatio="none"
        >
          <polyline
            points={points}
            fill="none"
            stroke="#7e22ce"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={(series.length - 1) * stepX}
            cy={H - ((series[series.length - 1] - min) / range) * (H - 4) - 2}
            r="3"
            fill="#7e22ce"
          />
        </svg>
        <div className="mt-2 grid grid-cols-3 gap-1 text-[9px]">
          <div>
            <p className="uppercase tracking-wider text-slate-500">Atual</p>
            <p className="text-xs font-bold tabular-nums text-slate-900">
              R$ 29,00
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-slate-500">Mín</p>
            <p className="text-xs font-bold tabular-nums text-green-700">
              R$ 22,00
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-slate-500">Máx</p>
            <p className="text-xs font-bold tabular-nums text-red-700">
              R$ 29,00
            </p>
          </div>
        </div>
        <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-700">
          <TrendingUp className="h-2.5 w-2.5 text-red-600" />
          <span>+31,8% desde o cadastro</span>
          <span className="ml-auto text-slate-400">4 mudanças em 90d</span>
        </p>
      </div>

      <ul className="mt-3 space-y-1.5 max-w-xs">
        {entries.map((e, i) => (
          <li
            key={i}
            className="rounded-md border border-slate-100 bg-white px-2 py-1.5 text-[10px]"
          >
            <div className="flex justify-between text-slate-500">
              <span>{e.date}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 tabular-nums">
              <span className="text-slate-500 line-through">
                R$ {e.old.toFixed(2)}
              </span>
              <span className="text-slate-900 font-medium">
                → R$ {e.new.toFixed(2)}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700 ml-auto">
                <TrendingUp className="h-2 w-2" />+{e.delta.toFixed(1)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
