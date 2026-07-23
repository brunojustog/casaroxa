import { redirect } from "next/navigation";
import { Smartphone, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { PushBroadcastForm } from "@/components/notificacoes/PushBroadcastForm";
import {
  countCustomerSubscriptions,
  isPushConfigured,
  listPushBroadcasts,
} from "@/server/services/push.service";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export default async function NotificacoesPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [subscribers, broadcasts, configured] = await Promise.all([
    countCustomerSubscriptions(),
    listPushBroadcasts(20),
    Promise.resolve(isPushConfigured()),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notificações do app"
        description="Mande avisos direto pro celular de quem instalou o app da Casa Roxa. Custo: zero."
      />

      {!configured && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Push não configurado no servidor (chaves VAPID ausentes no ambiente).
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-roxa-100 text-roxa-700">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {subscribers}
              </p>
              <p className="text-xs text-slate-500">
                {subscribers === 1
                  ? "aparelho com notificações ativas"
                  : "aparelhos com notificações ativas"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-green-100 text-green-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Como crescer essa lista
              </p>
              <p className="text-xs text-slate-500">
                Sorteios exclusivos do app + divulgar o banner &quot;Instalar
                app&quot; do site.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <PushBroadcastForm disabled={!configured} />

      {broadcasts.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 font-serif text-lg font-semibold text-roxa-900">
              Últimos envios
            </h2>
            <ul className="divide-y divide-slate-100">
              {broadcasts.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{b.title}</p>
                    <p className="truncate text-xs text-slate-600">{b.body}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <p>{fmtDateTime(b.createdAt)}</p>
                    <p className="tabular-nums">
                      ✓ {b.sentCount}
                      {b.failCount > 0 && (
                        <span className="text-red-600"> · ✗ {b.failCount}</span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
