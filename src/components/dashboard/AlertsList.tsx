import Link from "next/link";
import { AlertTriangle, AlertCircle, Info, ChevronRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardAlert } from "@/server/services/dashboard.service";

const ICON = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE_CLASS = {
  danger: "bg-red-50 text-red-700 ring-red-200",
  warning: "bg-yellow-50 text-yellow-700 ring-yellow-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
};

export function AlertsList({ alerts }: { alerts: DashboardAlert[] }) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Nenhum alerta — tudo em ordem.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alertas ({alerts.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-slate-100">
          {alerts.map((a) => {
            const Icon = ICON[a.severity];
            return (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className={`grid h-8 w-8 place-items-center rounded-full ring-1 ring-inset ${TONE_CLASS[a.severity]}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{a.title}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 tabular-nums">
                    {a.count}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
