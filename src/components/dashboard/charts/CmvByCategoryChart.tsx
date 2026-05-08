"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryCmvPoint } from "@/server/services/dashboard.service";

const ROXA = "#7e22ce";
const ROXA_LIGHT = "#a855f7";
const WARN = "#ea580c";

export function CmvByCategoryChart({
  data,
  defaultTarget = 0.5,
}: {
  data: CategoryCmvPoint[];
  defaultTarget?: number;
}) {
  if (data.length === 0) {
    return <Empty>Sem dados de CMV — cadastre produtos com preço e ficha.</Empty>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="category" stroke="#94a3b8" fontSize={11} />
        <YAxis
          stroke="#94a3b8"
          fontSize={11}
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "CMV médio"]}
        />
        <ReferenceLine
          y={defaultTarget}
          stroke={WARN}
          strokeDasharray="3 3"
          label={{ value: `Meta ${(defaultTarget * 100).toFixed(0)}%`, position: "right", fontSize: 10, fill: WARN }}
        />
        <Bar dataKey="avgCmv" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.avgCmv > defaultTarget ? WARN : ROXA} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-[240px] place-items-center text-xs text-slate-500">
      {children}
    </div>
  );
}

// reexporta a cor para outros charts
export { ROXA, ROXA_LIGHT, WARN };
