"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import { updateSettingsAction } from "@/server/actions/settings";

type Defaults = {
  businessName: string;
  fixedMonthlyCost: number;
  investedAmount: number;
  plannedInvestment: number;
  targetAverageTicket: number;
  targetOrdersPerWeekend: number;
  weekendsPerMonth: number;
  defaultCmvChicken: number;
  defaultCmvBeefRib: number;
  defaultCmvPork: number;
  defaultCmvSides: number;
  defaultCmvExtras: number;
  defaultCmvBeverages: number;
  defaultCmvCombos: number;
  cardFeePercent: number;
  appFeePercent: number;
  beefRibLossPercent: number;
  porkRibLossPercent: number;
  pancetaLossPercent: number;
  porkLoinLossPercent: number;
};

const FACTORY_DEFAULTS: Defaults = {
  businessName: "Casa Roxa Assados",
  fixedMonthlyCost: 1500,
  investedAmount: 5000,
  plannedInvestment: 5000,
  targetAverageTicket: 75,
  targetOrdersPerWeekend: 100,
  weekendsPerMonth: 4,
  defaultCmvChicken: 0.5,
  defaultCmvBeefRib: 0.5,
  defaultCmvPork: 0.5,
  defaultCmvSides: 0.35,
  defaultCmvExtras: 0.35,
  defaultCmvBeverages: 0.7,
  defaultCmvCombos: 0.45,
  cardFeePercent: 0,
  appFeePercent: 0,
  beefRibLossPercent: 0.35,
  porkRibLossPercent: 0.3,
  pancetaLossPercent: 0.3,
  porkLoinLossPercent: 0.25,
};

function toState(d: Defaults) {
  return {
    businessName: d.businessName,
    investedAmount: String(d.investedAmount),
    plannedInvestment: String(d.plannedInvestment),
    targetAverageTicket: String(d.targetAverageTicket),
    targetOrdersPerWeekend: String(d.targetOrdersPerWeekend),
    weekendsPerMonth: String(d.weekendsPerMonth),
    defaultCmvChicken: String(d.defaultCmvChicken * 100),
    defaultCmvBeefRib: String(d.defaultCmvBeefRib * 100),
    defaultCmvPork: String(d.defaultCmvPork * 100),
    defaultCmvSides: String(d.defaultCmvSides * 100),
    defaultCmvExtras: String(d.defaultCmvExtras * 100),
    defaultCmvBeverages: String(d.defaultCmvBeverages * 100),
    defaultCmvCombos: String(d.defaultCmvCombos * 100),
    cardFeePercent: String(d.cardFeePercent * 100),
    appFeePercent: String(d.appFeePercent * 100),
    beefRibLossPercent: String(d.beefRibLossPercent * 100),
    porkRibLossPercent: String(d.porkRibLossPercent * 100),
    pancetaLossPercent: String(d.pancetaLossPercent * 100),
    porkLoinLossPercent: String(d.porkLoinLossPercent * 100),
  };
}

export function SettingsForm({ initial }: { initial: Defaults }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [state, setState] = useState(toState(initial));

  function set<K extends keyof typeof state>(key: K, value: string) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function reset() {
    if (!window.confirm("Restaurar valores padrão? Os atuais serão perdidos (mas ficam no histórico).")) return;
    setState(toState(FACTORY_DEFAULTS));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updateSettingsAction(state);
      if (!res.ok) setMsg({ type: "err", text: res.error });
      else {
        setMsg({ type: "ok", text: "Configurações salvas." });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Nome do negócio" required>
            <Input value={state.businessName} onChange={(e) => set("businessName", e.currentTarget.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operação e investimento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label="Custo fixo mensal (R$)"
            hint="Soma dos itens ativos em /custos-fixos. Não editável aqui."
          >
            <div className="flex h-10 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              <span className="font-medium tabular-nums">
                {formatBRL(initial.fixedMonthlyCost)}
              </span>
              <Link
                href="/custos-fixos"
                className="inline-flex items-center gap-1 text-xs text-roxa-700 hover:underline"
              >
                Editar <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </Field>
          <Field label="Investimento já realizado (R$)">
            <Input type="number" step="0.01" min="0" value={state.investedAmount} onChange={(e) => set("investedAmount", e.currentTarget.value)} />
          </Field>
          <Field label="Investimento adicional previsto (R$)">
            <Input type="number" step="0.01" min="0" value={state.plannedInvestment} onChange={(e) => set("plannedInvestment", e.currentTarget.value)} />
          </Field>
          <Field label="Ticket médio alvo (R$)">
            <Input type="number" step="0.01" min="0" value={state.targetAverageTicket} onChange={(e) => set("targetAverageTicket", e.currentTarget.value)} />
          </Field>
          <Field label="Pedidos por fim de semana alvo">
            <Input type="number" min="0" value={state.targetOrdersPerWeekend} onChange={(e) => set("targetOrdersPerWeekend", e.currentTarget.value)} />
          </Field>
          <Field label="Fins de semana por mês">
            <Input type="number" min="1" max="10" value={state.weekendsPerMonth} onChange={(e) => set("weekendsPerMonth", e.currentTarget.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metas de CMV padrão (%)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Frango">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvChicken} onChange={(e) => set("defaultCmvChicken", e.currentTarget.value)} />
          </Field>
          <Field label="Costela">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvBeefRib} onChange={(e) => set("defaultCmvBeefRib", e.currentTarget.value)} />
          </Field>
          <Field label="Suínos">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvPork} onChange={(e) => set("defaultCmvPork", e.currentTarget.value)} />
          </Field>
          <Field label="Acompanhamentos">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvSides} onChange={(e) => set("defaultCmvSides", e.currentTarget.value)} />
          </Field>
          <Field label="Extras">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvExtras} onChange={(e) => set("defaultCmvExtras", e.currentTarget.value)} />
          </Field>
          <Field label="Bebidas">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvBeverages} onChange={(e) => set("defaultCmvBeverages", e.currentTarget.value)} />
          </Field>
          <Field label="Combos">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvCombos} onChange={(e) => set("defaultCmvCombos", e.currentTarget.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxas de venda (%)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Taxa média de cartão">
            <Input type="number" step="0.1" min="0" max="100" value={state.cardFeePercent} onChange={(e) => set("cardFeePercent", e.currentTarget.value)} />
          </Field>
          <Field label="Taxa média de delivery/app">
            <Input type="number" step="0.1" min="0" max="100" value={state.appFeePercent} onChange={(e) => set("appFeePercent", e.currentTarget.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perdas médias por carne (%)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Costela bovina">
            <Input type="number" step="0.1" min="0" max="100" value={state.beefRibLossPercent} onChange={(e) => set("beefRibLossPercent", e.currentTarget.value)} />
          </Field>
          <Field label="Costelinha suína">
            <Input type="number" step="0.1" min="0" max="100" value={state.porkRibLossPercent} onChange={(e) => set("porkRibLossPercent", e.currentTarget.value)} />
          </Field>
          <Field label="Panceta">
            <Input type="number" step="0.1" min="0" max="100" value={state.pancetaLossPercent} onChange={(e) => set("pancetaLossPercent", e.currentTarget.value)} />
          </Field>
          <Field label="Lombo / pernil">
            <Input type="number" step="0.1" min="0" max="100" value={state.porkLoinLossPercent} onChange={(e) => set("porkLoinLossPercent", e.currentTarget.value)} />
          </Field>
        </CardContent>
      </Card>

      {msg && (
        <div
          className={
            msg.type === "ok"
              ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {msg.text}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={reset} disabled={isPending}>
          Restaurar padrão
        </Button>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}
