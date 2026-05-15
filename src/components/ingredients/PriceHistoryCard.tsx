import { History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatDateTime } from "@/lib/format";

type Entry = {
  id: string;
  oldPrice: number | null;
  newPrice: number | null;
  changedAt: Date;
  changedBy?: { name: string } | null;
};

export function PriceHistoryCard({
  history,
  currentPrice,
}: {
  history: Entry[];
  currentPrice: number;
}) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="h-4 w-4 text-slate-500" />
            Histórico de preço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500">
            Sem alterações registradas. O preço atual é{" "}
            <strong>{formatBRL(currentPrice)}</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Ordena cronologicamente pra sparkline (esquerda = antigo, direita = atual)
  const sorted = [...history].sort(
    (a, b) => a.changedAt.getTime() - b.changedAt.getTime(),
  );
  // Inclui o preço atual no final da série
  const series: number[] = [];
  // Primeiro ponto: oldPrice da primeira entrada (preço antes da primeira mudança)
  if (sorted[0]?.oldPrice != null) series.push(Number(sorted[0].oldPrice));
  for (const e of sorted) {
    if (e.newPrice != null) series.push(Number(e.newPrice));
  }
  // currentPrice fecha a linha (caso ainda não tenha entrada recente)
  if (series[series.length - 1] !== currentPrice) series.push(currentPrice);

  const min = Math.min(...series);
  const max = Math.max(...series);
  const first = series[0] ?? currentPrice;
  const totalDeltaPct = first > 0 ? ((currentPrice - first) / first) * 100 : 0;

  const cutoff90 = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const changesLast90 = history.filter(
    (h) => h.changedAt.getTime() > cutoff90,
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="h-4 w-4 text-slate-500" />
          Histórico de preço
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Sparkline + stats topo */}
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <Sparkline values={series} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
            <Stat
              label="Atual"
              value={formatBRL(currentPrice)}
              tone="slate"
            />
            <Stat label="Mín" value={formatBRL(min)} tone="green" />
            <Stat label="Máx" value={formatBRL(max)} tone="red" />
          </div>
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-700">
            {totalDeltaPct > 0 ? (
              <TrendingUp className="h-3 w-3 text-red-600" />
            ) : totalDeltaPct < 0 ? (
              <TrendingDown className="h-3 w-3 text-green-600" />
            ) : (
              <Minus className="h-3 w-3 text-slate-400" />
            )}
            <span>
              {totalDeltaPct === 0
                ? "Sem variação desde o cadastro"
                : `${totalDeltaPct > 0 ? "+" : ""}${totalDeltaPct.toFixed(1).replace(".", ",")}% desde o cadastro`}
            </span>
            <span className="ml-auto text-slate-400">
              {changesLast90} {changesLast90 === 1 ? "mudança" : "mudanças"} em 90d
            </span>
          </p>
        </div>

        {/* Lista detalhada (mais recente primeiro) */}
        <ul className="space-y-2">
          {history.slice(0, 8).map((h) => {
            const oldP = h.oldPrice != null ? Number(h.oldPrice) : 0;
            const newP = h.newPrice != null ? Number(h.newPrice) : 0;
            const deltaPct = oldP > 0 ? ((newP - oldP) / oldP) * 100 : 0;
            const isUp = newP > oldP;
            return (
              <li
                key={h.id}
                className="rounded-md border border-slate-100 bg-white px-3 py-2 text-xs"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-slate-500">
                    {formatDateTime(h.changedAt)}
                  </span>
                  {h.changedBy?.name && (
                    <span className="text-slate-400">{h.changedBy.name}</span>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 tabular-nums">
                  <span className="text-slate-500 line-through">
                    {formatBRL(oldP)}
                  </span>
                  <span className="text-slate-900 font-medium">
                    → {formatBRL(newP)}
                  </span>
                  {oldP > 0 && (
                    <span
                      className={
                        isUp
                          ? "inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700"
                          : newP < oldP
                            ? "inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700"
                            : "inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700"
                      }
                    >
                      {isUp ? (
                        <TrendingUp className="h-2.5 w-2.5" />
                      ) : newP < oldP ? (
                        <TrendingDown className="h-2.5 w-2.5" />
                      ) : null}
                      {deltaPct > 0 ? "+" : ""}
                      {deltaPct.toFixed(1).replace(".", ",")}%
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {history.length > 8 && (
          <p className="text-[10px] text-slate-400 italic">
            Mostrando 8 mais recentes de {history.length}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "green" | "red";
}) {
  const color =
    tone === "green"
      ? "text-green-700"
      : tone === "red"
        ? "text-red-700"
        : "text-slate-900";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-xs font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

/** Sparkline SVG inline simples — sem dependência externa. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 200;
  const H = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = W / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = H - ((v - min) / range) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastX = (values.length - 1) * stepX;
  const lastY =
    H - ((values[values.length - 1] - min) / range) * (H - 4) - 2;

  return (
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
      <circle cx={lastX} cy={lastY} r="2.5" fill="#7e22ce" />
    </svg>
  );
}
