import { redirect } from "next/navigation";
import { Sparkles, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { AiActionRow } from "@/components/ai-actions/AiActionRow";
import { listActions } from "@/server/services/ai-action.service";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AprovacoesIaPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const actions = await listActions({ status: "all" });
  const pending = actions.filter((a) => a.status === "PENDING");
  const history = actions.filter((a) => a.status !== "PENDING");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Aprovações da IA"
        description="Ações propostas pelo Chat IA aguardando sua decisão. Cada uma expira em 24h se não for aprovada ou rejeitada."
      />

      <Card>
        <CardContent className="p-4 flex items-start gap-2 text-sm text-slate-600">
          <Clock className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <p>
            <strong>{pending.length}</strong>{" "}
            {pending.length === 1
              ? "ação pendente"
              : "ações pendentes"}{" "}
            de aprovação. Ações aprovadas são executadas na hora e não têm
            desfazer simples — confira o payload antes de aprovar.
          </p>
        </CardContent>
      </Card>

      {/* Pendentes */}
      <section className="space-y-3">
        <h2 className="font-serif text-base font-semibold text-slate-900">
          Pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <EmptyState>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Sparkles className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">
                Nada pendente agora. Quando a IA sugerir algo, aparece aqui.
              </p>
            </div>
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {pending.map((a) => (
              <AiActionRow key={a.id} action={a} />
            ))}
          </ul>
        )}
      </section>

      {/* Histórico */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-base font-semibold text-slate-900">
            Histórico ({history.length})
          </h2>
          <ul className="space-y-2 opacity-70">
            {history.map((a) => (
              <AiActionRow key={a.id} action={a} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
