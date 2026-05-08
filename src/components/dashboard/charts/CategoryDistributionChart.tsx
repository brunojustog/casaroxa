"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { CategoryDistPoint } from "@/server/services/dashboard.service";

const COLORS = ["#7e22ce", "#a855f7", "#c084fc", "#d8b4fe", "#e9d5ff", "#f3e8ff"];

export function CategoryDistributionChart({ data }: { data: CategoryDistPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-[240px] place-items-center text-xs text-slate-500">
        Sem produtos cadastrados.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="category"
          cx="40%"
          cy="50%"
          innerRadius={45}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(value: number, name: string) => [`${value} produtos`, name]}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
