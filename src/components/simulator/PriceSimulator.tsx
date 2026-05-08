"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";
import {
  PRODUCT_CATEGORY_LABEL,
} from "@/lib/enums";
import { formatBRL, formatPercent } from "@/lib/format";
import {
  calculateCmv,
  calculateCmvWithFees,
  calculateGrossProfit,
  calculateNetRevenue,
  calculateSuggestedPrice,
} from "@/domain/calculations";
import {
  applyPriceAction,
  saveSimulationAction,
} from "@/server/actions/simulations";
import type { ProductCategory, SimulationTarget } from "@prisma/client";

export type SimulatorTarget = {
  id: string;
  name: string;
  category: ProductCategory;
  totalCost: number;
  salePrice: number | null;
  targetCmv: number | null;
};

type Props = {
  products: SimulatorTarget[];
  combos: SimulatorTarget[];
  defaults: {
    cardFeePercent: number;
    appFeePercent: number;
    targetCmvProducts: number;
    targetCmvCombos: number;
  };
};

export function PriceSimulator({ products, combos, defaults }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverMsg, setServerMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ---------- seleção do alvo ----------
  const [targetType, setTargetType] = useState<SimulationTarget>("PRODUTO");
  const [targetId, setTargetId] = useState<string>(products[0]?.id ?? "");

  const list = targetType === "PRODUTO" ? products : combos;
  const target = useMemo(() => list.find((t) => t.id === targetId), [list, targetId]);

  // ---------- inputs ----------
  const defaultTarget =
    target?.targetCmv ??
    (targetType === "PRODUTO" ? defaults.targetCmvProducts : defaults.targetCmvCombos);

  const [targetCmvPercent, setTargetCmvPercent] = useState<string>(
    String((defaultTarget * 100).toFixed(1)),
  );
  const [simulatedPriceStr, setSimulatedPriceStr] = useState<string>("");
  const [cardFeeStr, setCardFeeStr] = useState<string>(String((defaults.cardFeePercent * 100).toFixed(1)));
  const [appFeeStr, setAppFeeStr] = useState<string>(String((defaults.appFeePercent * 100).toFixed(1)));
  const [discountStr, setDiscountStr] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");

  // Reset alguns inputs quando alvo muda
  function selectTargetType(t: SimulationTarget) {
    setTargetType(t);
    const newList = t === "PRODUTO" ? products : combos;
    const first = newList[0];
    setTargetId(first?.id ?? "");
    setSimulatedPriceStr("");
    if (first) {
      const tg = first.targetCmv ?? (t === "PRODUTO" ? defaults.targetCmvProducts : defaults.targetCmvCombos);
      setTargetCmvPercent(String((tg * 100).toFixed(1)));
    }
  }

  function selectTarget(id: string) {
    setTargetId(id);
    setSimulatedPriceStr("");
    const tg = (list.find((t) => t.id === id)?.targetCmv) ??
      (targetType === "PRODUTO" ? defaults.targetCmvProducts : defaults.targetCmvCombos);
    setTargetCmvPercent(String((tg * 100).toFixed(1)));
  }

  // ---------- cálculos ----------
  const cost = target?.totalCost ?? 0;
  const currentPrice = target?.salePrice ?? 0;
  const targetFraction = (Number(targetCmvPercent) || 0) / 100;
  const cardFraction = (Number(cardFeeStr) || 0) / 100;
  const appFraction = (Number(appFeeStr) || 0) / 100;
  const discountFraction = (Number(discountStr) || 0) / 100;

  const suggested = targetFraction > 0 && cost > 0
    ? Number(calculateSuggestedPrice(cost, targetFraction))
    : 0;

  const simulatedPrice = Number(String(simulatedPriceStr).replace(",", ".")) || suggested;

  const currentCmv = currentPrice > 0 ? Number(calculateCmv(cost, currentPrice)) : null;
  const currentProfit = currentPrice > 0 ? Number(calculateGrossProfit(cost, currentPrice)) : null;

  const simCmv = simulatedPrice > 0 ? Number(calculateCmv(cost, simulatedPrice)) : 0;
  const simProfit = simulatedPrice > 0 ? Number(calculateGrossProfit(cost, simulatedPrice)) : 0;

  const fees = {
    cardFeePercent: cardFraction,
    appFeePercent: appFraction,
    discountPercent: discountFraction,
  };
  const hasAnyFee = cardFraction + appFraction + discountFraction > 0;
  const netRevenue = simulatedPrice > 0 ? Number(calculateNetRevenue(simulatedPrice, fees)) : 0;
  const netCmv = simulatedPrice > 0 ? Number(calculateCmvWithFees(cost, simulatedPrice, fees)) : 0;
  const netProfit = netRevenue - cost;

  // ---------- handlers ----------
  function applyPrice() {
    if (!target) return;
    if (simulatedPrice <= 0) {
      setServerMsg({ type: "err", text: "Defina um preço simulado válido." });
      return;
    }
    startTransition(async () => {
      const res = await applyPriceAction({
        targetType,
        id: target.id,
        newPrice: simulatedPrice,
      });
      if (!res.ok) setServerMsg({ type: "err", text: res.error });
      else {
        setServerMsg({
          type: "ok",
          text: `Preço de ${target.name} atualizado para ${formatBRL(simulatedPrice)}.`,
        });
        router.refresh();
      }
    });
  }

  function saveSim() {
    if (!target) return;
    startTransition(async () => {
      const res = await saveSimulationAction({
        targetType,
        productId: targetType === "PRODUTO" ? target.id : null,
        comboId: targetType === "COMBO" ? target.id : null,
        currentCost: cost,
        currentPrice: currentPrice || null,
        targetCmv: targetCmvPercent,
        suggestedPrice: suggested,
        simulatedPrice,
        simulatedCmv: simCmv,
        simulatedGrossProfit: simProfit,
        cardFeePercent: cardFeeStr,
        appFeePercent: appFeeStr,
        discountPercent: discountStr,
        notes,
      });
      if (!res.ok) setServerMsg({ type: "err", text: res.error });
      else {
        setServerMsg({ type: "ok", text: "Simulação salva." });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Seleção de alvo */}
      <Card>
        <CardHeader>
          <CardTitle>1. Escolha o alvo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Tipo">
              <Select value={targetType} onChange={(e) => selectTargetType(e.currentTarget.value as SimulationTarget)}>
                <option value="PRODUTO">Produto</option>
                <option value="COMBO">Combo</option>
              </Select>
            </Field>
            <Field label="Item" className="md:col-span-2">
              <Select value={targetId} onChange={(e) => selectTarget(e.currentTarget.value)}>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {PRODUCT_CATEGORY_LABEL[t.category]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {!target ? (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Cadastre ao menos um {targetType === "PRODUTO" ? "produto" : "combo"} ativo para simular.
        </div>
      ) : (
        <>
          {/* Estado atual */}
          <Card>
            <CardHeader>
              <CardTitle>Estado atual de {target.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mini label="Custo" value={formatBRL(cost)} />
                <Mini label="Preço" value={currentPrice > 0 ? formatBRL(currentPrice) : "—"} />
                <Mini
                  label="CMV atual"
                  value={currentCmv !== null ? formatPercent(currentCmv) : "—"}
                  accent={currentCmv !== null && currentCmv > targetFraction ? "warning" : "ok"}
                />
                <Mini label="Lucro" value={currentProfit !== null ? formatBRL(currentProfit) : "—"} />
              </div>
              <div className="mt-3">
                <ProductStatusBadge cost={cost} price={currentPrice} targetCmv={targetFraction} />
              </div>
            </CardContent>
          </Card>

          {/* Inputs e simulação */}
          <Card>
            <CardHeader>
              <CardTitle>2. Simulação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Meta de CMV (%)" hint="Para gerar o preço sugerido.">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={targetCmvPercent}
                    onChange={(e) => setTargetCmvPercent(e.currentTarget.value)}
                  />
                </Field>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1.5">Preço sugerido</p>
                  <p className="rounded-md border border-slate-200 bg-slate-50 h-10 px-3 grid items-center text-base font-bold text-roxa-800 tabular-nums">
                    {suggested > 0 ? formatBRL(suggested) : "—"}
                  </p>
                </div>
                <Field label="Novo preço a testar (R$)" hint="Vazio = usa o sugerido.">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={simulatedPriceStr}
                    placeholder={suggested > 0 ? formatBRL(suggested) : ""}
                    onChange={(e) => setSimulatedPriceStr(e.currentTarget.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                <Mini
                  label="CMV simulado"
                  value={simulatedPrice > 0 ? formatPercent(simCmv) : "—"}
                  accent={simulatedPrice > 0 && simCmv > targetFraction ? "warning" : "ok"}
                />
                <Mini
                  label="Lucro bruto"
                  value={simulatedPrice > 0 ? formatBRL(simProfit) : "—"}
                />
                <Mini
                  label={hasAnyFee ? "CMV líquido" : "CMV (sem taxa)"}
                  value={simulatedPrice > 0 ? formatPercent(netCmv) : "—"}
                  accent={netCmv > targetFraction ? "warning" : "ok"}
                />
                <Mini
                  label={hasAnyFee ? "Lucro líquido" : "Lucro (sem taxa)"}
                  value={simulatedPrice > 0 ? formatBRL(netProfit) : "—"}
                />
              </div>

              <div className="flex items-center justify-center text-xs text-slate-400">
                <ArrowDown className="h-3 w-3" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Taxa cartão (%)">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={cardFeeStr}
                    onChange={(e) => setCardFeeStr(e.currentTarget.value)}
                  />
                </Field>
                <Field label="Taxa app/delivery (%)">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={appFeeStr}
                    onChange={(e) => setAppFeeStr(e.currentTarget.value)}
                  />
                </Field>
                <Field label="Desconto promocional (%)">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={discountStr}
                    onChange={(e) => setDiscountStr(e.currentTarget.value)}
                  />
                </Field>
              </div>

              <Field label="Notas da simulação (opcional)">
                <Input value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
              </Field>
            </CardContent>
          </Card>

          {serverMsg && (
            <div
              className={
                serverMsg.type === "ok"
                  ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
                  : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              }
            >
              {serverMsg.text}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={saveSim} disabled={isPending}>
              <Save className="h-4 w-4" />
              Salvar simulação
            </Button>
            <Button type="button" onClick={applyPrice} disabled={isPending || simulatedPrice <= 0}>
              {isPending
                ? "Aplicando…"
                : `Aplicar ${formatBRL(simulatedPrice || suggested)} ao ${targetType === "PRODUTO" ? "produto" : "combo"}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "ok" | "warning" | "neutral";
}) {
  const color =
    accent === "warning"
      ? "text-orange-700"
      : accent === "ok"
        ? "text-green-700"
        : "text-slate-900";
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
