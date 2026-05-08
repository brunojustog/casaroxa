"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatPercent } from "@/lib/format";
import { calculateScenario } from "@/domain/calculations";
import {
  createScenarioAction,
  updateScenarioAction,
} from "@/server/actions/scenarios";

type Mode = { type: "create" } | { type: "edit"; id: string };

export function ScenarioForm({
  mode,
  initial,
  fixedMonthlyCost,
  totalInvestment,
}: {
  mode: Mode;
  initial?: {
    name: string;
    ordersPerWeekend: number;
    averageTicket: number;
    weekendsPerMonth: number;
    estimatedCmvPercent: number; // fração 0..1
    notes: string | null;
  };
  fixedMonthlyCost: number;
  totalInvestment: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [orders, setOrders] = useState(String(initial?.ordersPerWeekend ?? 100));
  const [ticket, setTicket] = useState(String(initial?.averageTicket ?? 75));
  const [weekends, setWeekends] = useState(String(initial?.weekendsPerMonth ?? 4));
  const [cmvPercent, setCmvPercent] = useState(
    String(((initial?.estimatedCmvPercent ?? 0.5) * 100).toFixed(1)),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const preview = useMemo(() => {
    const ordersN = Number(orders) || 0;
    const ticketN = Number(String(ticket).replace(",", ".")) || 0;
    const weekendsN = Number(weekends) || 4;
    const cmvFraction = (Number(cmvPercent) || 0) / 100;

    return calculateScenario({
      ordersPerWeekend: ordersN,
      averageTicket: ticketN,
      weekendsPerMonth: weekendsN,
      estimatedCmvPercent: cmvFraction,
      fixedMonthlyCost,
      totalInvestment,
    });
  }, [orders, ticket, weekends, cmvPercent, fixedMonthlyCost, totalInvestment]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const payload = {
      name,
      ordersPerWeekend: orders,
      averageTicket: ticket,
      weekendsPerMonth: weekends,
      estimatedCmvPercent: cmvPercent,
      notes,
    };
    startTransition(async () => {
      const res =
        mode.type === "create"
          ? await createScenarioAction(payload)
          : await updateScenarioAction(mode.id, payload);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push("/cenarios");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Premissas do cenário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Nome do cenário" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  placeholder="Ex.: Conservador, Meta, Excelente"
                  required
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Pedidos por fim de semana" required>
                  <Input
                    type="number"
                    min="0"
                    value={orders}
                    onChange={(e) => setOrders(e.currentTarget.value)}
                  />
                </Field>
                <Field label="Ticket médio (R$)" required>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ticket}
                    onChange={(e) => setTicket(e.currentTarget.value)}
                  />
                </Field>
                <Field label="Fins de semana / mês" required>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={weekends}
                    onChange={(e) => setWeekends(e.currentTarget.value)}
                  />
                </Field>
              </div>

              <Field label="CMV estimado (%)" hint="Custo total dos itens vendidos / faturamento.">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={cmvPercent}
                  onChange={(e) => setCmvPercent(e.currentTarget.value)}
                />
              </Field>

              <Field label="Notas">
                <Textarea
                  rows={3}
                  value={notes ?? ""}
                  onChange={(e) => setNotes(e.currentTarget.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Resultado estimado</h3>
          <Mini label="Faturamento por fim de semana" value={formatBRL(preview.weekendRevenue)} />
          <Mini label="Faturamento mensal" value={formatBRL(preview.monthlyRevenue)} primary />
          <Mini label={`CMV estimado (${formatPercent(Number(cmvPercent) / 100)})`} value={formatBRL(preview.estimatedCmv)} />
          <Mini label="Lucro bruto" value={formatBRL(preview.grossProfit)} />
          <Mini label={`Custo fixo mensal`} value={formatBRL(fixedMonthlyCost)} />
          <Mini
            label="Resultado mensal"
            value={formatBRL(preview.estimatedResult)}
            accent={Number(preview.estimatedResult) > 0 ? "ok" : "warning"}
            primary
          />
          <Mini
            label="Payback (meses)"
            value={preview.paybackMonths ? `${Number(preview.paybackMonths).toFixed(1)} meses` : "—"}
            hint={`Investimento total: ${formatBRL(totalInvestment)}`}
          />
        </aside>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/cenarios"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Salvando…" : mode.type === "create" ? "Criar cenário" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}

function Mini({
  label,
  value,
  hint,
  accent = "neutral",
  primary = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "ok" | "warning" | "neutral";
  primary?: boolean;
}) {
  const valueColor =
    accent === "warning"
      ? "text-orange-700"
      : accent === "ok"
        ? "text-green-700"
        : "text-slate-900";
  return (
    <div
      className={
        primary
          ? "rounded-md border border-roxa-200 bg-roxa-50 px-3 py-2"
          : "rounded-md border border-slate-200 bg-white px-3 py-2"
      }
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${valueColor}`}>{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
