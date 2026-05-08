"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TopItemPoint } from "@/server/services/dashboard.service";

const ROXA = "#7e22ce";
const WARN = "#ea580c";

export function TopItemsChart({
  data,
  format = "money",
  color = "roxa",
}: {
  data: TopItemPoint[];
  format?: "money" | "percent";
  color?: "roxa" | "warn";
}) {
  if (data.length === 0) {
    return (
      <div className="grid h-[240px] place-items-center text-xs text-slate-500">
        Sem dados.
      </div>
    );
  }

  const fillColor = color === "warn" ? WARN : ROXA;
  const formatter = (v: number) =>
    format === "percent"
      ? `${(v * 100).toFixed(1)}%`
      : new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(v);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis
          type="number"
          stroke="#94a3b8"
          fontSize={10}
          tickFormatter={formatter}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#94a3b8"
          fontSize={10}
          width={130}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(value: number) => [formatter(value), format === "percent" ? "CMV" : "Lucro"]}
        />
        <Bar dataKey="value" fill={fillColor} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
