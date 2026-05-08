"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INGREDIENT_CATEGORY_LABEL, INGREDIENT_UNIT_LABEL } from "@/lib/enums";
import { STOCK_MOVEMENT_TYPE_LABEL } from "@/lib/stock-enums";
import { formatBRL } from "@/lib/format";
import { registerStockMovementAction } from "@/server/actions/stock";
import type {
  IngredientCategory,
  IngredientUnit,
  StockMovementType,
} from "@prisma/client";

export type StockFormIngredient = {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: IngredientUnit;
  unitCost: number;
};

const TYPE_ORDER: StockMovementType[] = ["ENTRADA", "SAIDA", "PERDA", "AJUSTE"];

export function StockMovementForm({
  ingredients,
  preselectedIngredientId,
  preselectedType,
}: {
  ingredients: StockFormIngredient[];
  preselectedIngredientId?: string;
  preselectedType?: StockMovementType;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [ingredientId, setIngredientId] = useState<string>(
    preselectedIngredientId ?? ingredients[0]?.id ?? "",
  );
  const [type, setType] = useState<StockMovementType>(preselectedType ?? "ENTRADA");
  const [quantity, setQuantity] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [lotNumber, setLotNumber] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const ingredientById = useMemo(() => {
    const m = new Map<string, StockFormIngredient>();
    for (const i of ingredients) m.set(i.id, i);
    return m;
  }, [ingredients]);

  const selected = ingredientById.get(ingredientId);
  const isEntry = type === "ENTRADA" || type === "AJUSTE";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);

    const payload = {
      ingredientId,
      type,
      quantity,
      unitCost: isEntry ? unitCost : null,
      lotNumber: isEntry ? lotNumber : null,
      expiryDate: isEntry && expiryDate ? expiryDate : null,
      notes,
    };

    startTransition(async () => {
      const res = await registerStockMovementAction(payload);
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      const newBalance = res.data?.balance ?? 0;
      setMsg({
        type: "ok",
        text: `Movimento registrado. Saldo agora: ${newBalance.toFixed(4)} ${selected ? INGREDIENT_UNIT_LABEL[selected.unit] : ""}`,
      });
      // limpa apenas a quantidade — usuário pode querer registrar mais movimentos do mesmo item
      setQuantity("");
      setNotes("");
      router.refresh();
    });
  }

  if (ingredients.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-500">
          Cadastre algum ingrediente em <Link className="text-roxa-700 hover:underline" href="/ingredientes/novo">/ingredientes/novo</Link> antes de lançar movimento de estoque.
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Lançar movimento de estoque</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Ingrediente" required className="md:col-span-2">
              <Select
                value={ingredientId}
                onChange={(e) => setIngredientId(e.currentTarget.value)}
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} — {INGREDIENT_CATEGORY_LABEL[i.category]} ({INGREDIENT_UNIT_LABEL[i.unit]})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de movimento" required>
              <Select
                value={type}
                onChange={(e) => setType(e.currentTarget.value as StockMovementType)}
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {STOCK_MOVEMENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label={`Quantidade ${selected ? `(${INGREDIENT_UNIT_LABEL[selected.unit]})` : ""}`}
              required
              hint="Sempre positivo. O tipo já indica direção (entrada / saída)."
            >
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.currentTarget.value)}
                required
              />
            </Field>
            {isEntry && (
              <Field
                label="Custo unitário (R$)"
                hint={`Default: ${selected ? formatBRL(selected.unitCost) : "—"} (custo cadastrado).`}
              >
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={unitCost}
                  placeholder={selected ? String(selected.unitCost) : ""}
                  onChange={(e) => setUnitCost(e.currentTarget.value)}
                />
              </Field>
            )}
          </div>

          {isEntry && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Número do lote (opcional)">
                <Input
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.currentTarget.value)}
                />
              </Field>
              <Field label="Data de validade (opcional)">
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.currentTarget.value)}
                />
              </Field>
            </div>
          )}

          <Field label="Observações">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              placeholder="Ex.: contagem física, lote vencido, ajuste mensal..."
            />
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
        <Link
          href="/estoque"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Voltar
        </Link>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Registrando…" : "Registrar movimento"}
        </Button>
      </div>
    </form>
  );
}
