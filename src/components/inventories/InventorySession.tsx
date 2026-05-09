"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { INGREDIENT_UNIT_LABEL, INGREDIENT_CATEGORY_LABEL } from "@/lib/enums";
import {
  addInventoryItemAction,
  cancelInventoryAction,
  closeInventoryAction,
  countInventoryItemAction,
  removeInventoryItemAction,
} from "@/server/actions/inventories";
import type { IngredientCategory, IngredientUnit, InventoryStatus } from "@prisma/client";

type Item = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  ingredientUnit: IngredientUnit;
  expectedQuantity: number;
  countedQuantity: number | null;
  unitCostSnapshot: number;
  notes: string | null;
  countedByName: string | null;
};

type AvailableIngredient = {
  id: string;
  name: string;
  unit: IngredientUnit;
  category: IngredientCategory;
};

const fmtQty = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(v);

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function InventorySession({
  inventoryId,
  status,
  items,
  availableIngredients,
}: {
  inventoryId: string;
  status: InventoryStatus;
  items: Item[];
  availableIngredients: AvailableIngredient[];
}) {
  const router = useRouter();
  const isOpen = status === "ABERTA";

  // Resumo das movimentações que serão criadas no fechamento.
  const summary = useMemo(() => {
    let surplusValue = 0;
    let lossValue = 0;
    let surplusCount = 0;
    let lossCount = 0;
    let countedCount = 0;
    for (const it of items) {
      if (it.countedQuantity === null) continue;
      countedCount += 1;
      const diff = it.countedQuantity - it.expectedQuantity;
      const value = Math.abs(diff) * it.unitCostSnapshot;
      if (diff > 0) {
        surplusValue += value;
        surplusCount += 1;
      } else if (diff < 0) {
        lossValue += value;
        lossCount += 1;
      }
    }
    return {
      countedCount,
      pendingCount: items.length - countedCount,
      surplusValue,
      lossValue,
      surplusCount,
      lossCount,
      netValue: surplusValue - lossValue,
    };
  }, [items]);

  return (
    <div className="space-y-6">
      {/* Resumo / preview do que será gerado */}
      {isOpen && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Itens contados"
            value={`${summary.countedCount} / ${items.length}`}
            tone={summary.countedCount === items.length ? "success" : "default"}
          />
          <SummaryCard
            label="Pendentes"
            value={String(summary.pendingCount)}
            tone={summary.pendingCount > 0 ? "warning" : "default"}
          />
          <SummaryCard
            label={`Sobras (${summary.surplusCount})`}
            value={fmtBRL(summary.surplusValue)}
            tone="info"
          />
          <SummaryCard
            label={`Perdas (${summary.lossCount})`}
            value={fmtBRL(summary.lossValue)}
            tone={summary.lossValue > 0 ? "warning" : "default"}
          />
        </div>
      )}

      {/* Adicionar item */}
      {isOpen && availableIngredients.length > 0 && (
        <AddItemForm
          inventoryId={inventoryId}
          available={availableIngredients}
        />
      )}

      {/* Tabela de itens */}
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Nenhum item na contagem. Use o seletor acima pra adicionar ingredientes.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Ingrediente</th>
                  <th className="px-3 py-2 text-right font-semibold">Sistema</th>
                  <th className="px-3 py-2 text-right font-semibold">Contado</th>
                  <th className="px-3 py-2 text-right font-semibold">Diferença</th>
                  <th className="px-3 py-2 text-right font-semibold">Impacto R$</th>
                  {isOpen && <th className="px-3 py-2 text-right font-semibold">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    inventoryId={inventoryId}
                    isOpen={isOpen}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ações de fechamento */}
      {isOpen && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <CancelButton
            inventoryId={inventoryId}
            onSuccess={() => router.refresh()}
          />
          <CloseButton
            inventoryId={inventoryId}
            countedCount={summary.countedCount}
            pendingCount={summary.pendingCount}
            onSuccess={() => router.refresh()}
          />
        </div>
      )}

      {!isOpen && (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Lock className="h-4 w-4" />
          {status === "FECHADA"
            ? "Contagem fechada. Os ajustes já foram lançados no estoque."
            : "Contagem cancelada — não gerou movimentos."}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-green-200 bg-green-50 text-green-900"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "info"
          ? "border-blue-200 bg-blue-50 text-blue-900"
          : "border-slate-200 bg-white text-slate-700";
  return (
    <div className={`rounded-lg border ${toneClass} p-3`}>
      <p className="text-[11px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function AddItemForm({
  inventoryId,
  available,
}: {
  inventoryId: string;
  available: AvailableIngredient[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ingredientId, setIngredientId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!ingredientId) return;
    setError(null);
    startTransition(async () => {
      const res = await addInventoryItemAction(inventoryId, { ingredientId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setIngredientId("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={ingredientId}
          onChange={(e) => setIngredientId(e.target.value)}
          className="min-w-[260px] flex-1"
        >
          <option value="">Adicionar ingrediente à contagem…</option>
          {available.map((ing) => (
            <option key={ing.id} value={ing.id}>
              {ing.name} ({INGREDIENT_UNIT_LABEL[ing.unit]}) ·{" "}
              {INGREDIENT_CATEGORY_LABEL[ing.category]}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          onClick={add}
          disabled={pending || !ingredientId}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function ItemRow({
  item,
  inventoryId,
  isOpen,
}: {
  item: Item;
  inventoryId: string;
  isOpen: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string>(
    item.countedQuantity === null ? "" : String(item.countedQuantity),
  );
  const [error, setError] = useState<string | null>(null);

  const counted = item.countedQuantity;
  const diff = counted === null ? null : counted - item.expectedQuantity;
  const impact =
    diff === null ? null : Math.abs(diff) * item.unitCostSnapshot;

  function save() {
    const parsed = parseFloat(editing.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Quantidade inválida");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await countInventoryItemAction(item.id, inventoryId, {
        countedQuantity: parsed,
        notes: null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`Remover "${item.ingredientName}" da contagem?`)) return;
    startTransition(async () => {
      const res = await removeInventoryItemAction(item.id, inventoryId);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  return (
    <tr>
      <td className="px-3 py-2">
        <p className="font-medium text-slate-900">{item.ingredientName}</p>
        <p className="text-xs text-slate-500">
          {INGREDIENT_UNIT_LABEL[item.ingredientUnit]} · custo{" "}
          {fmtBRL(item.unitCostSnapshot)}
        </p>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
        {fmtQty(item.expectedQuantity)}
      </td>
      <td className="px-3 py-2 text-right">
        {isOpen ? (
          <div className="flex items-center justify-end gap-1">
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={editing}
              onChange={(e) => setEditing(e.target.value)}
              onBlur={() => {
                if (editing.length > 0 && editing !== String(counted ?? "")) save();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-24 text-right"
              placeholder="—"
              disabled={pending}
            />
          </div>
        ) : (
          <span className="tabular-nums text-slate-700">
            {counted === null ? "—" : fmtQty(counted)}
          </span>
        )}
        {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
      </td>
      <td className="px-3 py-2 text-right">
        {diff === null ? (
          <span className="text-xs text-slate-400">aguardando contagem</span>
        ) : diff === 0 ? (
          <Badge tone="success">
            <CheckCircle2 className="h-3 w-3" /> bate
          </Badge>
        ) : diff > 0 ? (
          <span className="font-semibold text-blue-700 tabular-nums">
            +{fmtQty(diff)}
          </span>
        ) : (
          <span className="font-semibold text-red-700 tabular-nums">
            {fmtQty(diff)}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {impact === null || diff === 0 ? (
          <span className="text-slate-400">—</span>
        ) : diff && diff > 0 ? (
          <span className="text-blue-700">+{fmtBRL(impact)}</span>
        ) : (
          <span className="text-red-700">−{fmtBRL(impact)}</span>
        )}
      </td>
      {isOpen && (
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
            title="Remover da contagem"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      )}
    </tr>
  );
}

function CloseButton({
  inventoryId,
  countedCount,
  pendingCount,
  onSuccess,
}: {
  inventoryId: string;
  countedCount: number;
  pendingCount: number;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function close() {
    if (countedCount === 0) {
      window.alert("Conte pelo menos um item antes de fechar.");
      return;
    }
    const msg =
      pendingCount > 0
        ? `Tem ${pendingCount} item(ns) sem contagem. Esses serão ignorados (saldo do sistema fica como está). Fechar mesmo assim?`
        : "Fechar contagem? Os ajustes/perdas serão lançados no estoque agora.";
    if (!window.confirm(msg)) return;

    startTransition(async () => {
      const res = await closeInventoryAction(inventoryId);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      window.alert(
        `Contagem fechada. ${res.data?.movementsCreated ?? 0} movimento(s) gerado(s).`,
      );
      onSuccess();
    });
  }

  return (
    <Button type="button" onClick={close} disabled={pending}>
      <Lock className="h-4 w-4" />
      {pending ? "Fechando…" : "Fechar contagem e gerar ajustes"}
    </Button>
  );
}

function CancelButton({
  inventoryId,
  onSuccess,
}: {
  inventoryId: string;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function cancel() {
    if (
      !window.confirm(
        "Cancelar essa contagem? Nenhum ajuste será lançado no estoque.",
      )
    )
      return;
    startTransition(async () => {
      const res = await cancelInventoryAction(inventoryId);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      onSuccess();
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={cancel}
      disabled={pending}
    >
      <XCircle className="h-4 w-4" />
      {pending ? "Cancelando…" : "Cancelar contagem"}
    </Button>
  );
}
