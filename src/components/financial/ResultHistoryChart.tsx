"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const POSITIVE = "#15803d"; // green-700
const NEGATIVE = "#b91c1c"; // red-700

type Point = {
  monthLabel: string;
  operatingResult: number;
  revenue: number;
  cogs: number;
  fixedCosts: number;
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function ResultHistoryChart({ data }: { data: Point[] }) {
  if (data.length === 0 || data.every((d) => d.revenue === 0)) {
    return (
      <div className="grid h-[260px] place-items-center text-xs text-slate-500">
        Sem vendas registradas no período histórico.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="monthLabel" stroke="#94a3b8" fontSize={11} />
        <YAxis
          stroke="#94a3b8"
          fontSize={10}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          }
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(value: number) => [formatBRL(value), "Resultado"]}
          labelStyle={{ color: "#475569" }}
        />
        <Bar dataKey="operatingResult" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.operatingResult >= 0 ? POSITIVE : NEGATIVE}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
