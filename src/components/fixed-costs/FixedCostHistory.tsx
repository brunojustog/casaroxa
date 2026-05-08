import { History } from "lucide-react";
import { FixedCostFrequency } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatDateTime } from "@/lib/format";
import { FIXED_COST_FREQUENCY_LABEL } from "@/lib/enums";

type HistoryEntry = {
  id: string;
  oldAmount: unknown;
  newAmount: unknown;
  oldFrequency: FixedCostFrequency;
  newFrequency: FixedCostFrequency;
  oldActive: boolean;
  newActive: boolean;
  changedAt: Date;
  changedBy: { name: string } | null;
};

export function FixedCostHistory({ history }: { history: HistoryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="h-4 w-4 text-slate-500" />
          Histórico de alterações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">Sem alterações registradas.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => {
              const valueChanged =
                String(h.oldAmount) !== String(h.newAmount) ||
                h.oldFrequency !== h.newFrequency;
              const activeChanged = h.oldActive !== h.newActive;
              return (
                <li
                  key={h.id}
                  className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-slate-500">
                      {formatDateTime(h.changedAt)}
                    </span>
                    {h.changedBy?.name && (
                      <span className="text-slate-400">{h.changedBy.name}</span>
                    )}
                  </div>
                  {valueChanged && (
                    <div className="mt-1 text-slate-700">
                      <span className="line-through text-slate-400">
                        {formatBRL(h.oldAmount as never)} ·{" "}
                        {FIXED_COST_FREQUENCY_LABEL[h.oldFrequency]}
                      </span>
                      <span className="mx-1 text-slate-400">→</span>
                      <span className="font-medium">
                        {formatBRL(h.newAmount as never)} ·{" "}
                        {FIXED_COST_FREQUENCY_LABEL[h.newFrequency]}
                      </span>
                    </div>
                  )}
                  {activeChanged && (
                    <div className="mt-0.5 text-slate-600">
                      {h.newActive ? "Reativado" : "Inativado"}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
