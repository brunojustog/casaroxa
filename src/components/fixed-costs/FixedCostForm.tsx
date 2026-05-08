"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { FixedCostCategory, FixedCostFrequency } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import {
  FIXED_COST_CATEGORY_LABEL,
  FIXED_COST_FREQUENCY_LABEL,
  enumOptions,
} from "@/lib/enums";
import {
  fixedCostItemFormSchema,
  type FixedCostItemFormData,
} from "@/schemas/fixed-cost.schema";
import {
  createFixedCostItemAction,
  updateFixedCostItemAction,
} from "@/server/actions/fixed-costs";

type Mode = { type: "create" } | { type: "edit"; id: string };

export type FixedCostFormDefaults = Partial<{
  name: string;
  category: FixedCostCategory;
  frequency: FixedCostFrequency;
  amount: number;
  notes: string | null;
  active: boolean;
}>;

type FormShape = {
  name: string;
  category: FixedCostCategory;
  frequency: FixedCostFrequency;
  amount: string;
  notes: string;
  active: boolean;
};

function toFormShape(d: FixedCostFormDefaults | undefined): FormShape {
  return {
    name: d?.name ?? "",
    category: d?.category ?? FixedCostCategory.ALUGUEL,
    frequency: d?.frequency ?? FixedCostFrequency.MENSAL,
    amount: d?.amount !== undefined ? String(d.amount) : "",
    notes: d?.notes ?? "",
    active: d?.active ?? true,
  };
}

const CATEGORY_OPTIONS = enumOptions(FIXED_COST_CATEGORY_LABEL);
const FREQUENCY_OPTIONS = enumOptions(FIXED_COST_FREQUENCY_LABEL);

export function FixedCostForm({
  mode,
  defaultValues,
}: {
  mode: Mode;
  defaultValues?: FixedCostFormDefaults;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(fixedCostItemFormSchema),
    defaultValues: toFormShape(defaultValues) as unknown as FixedCostItemFormData,
  });

  const errors = form.formState.errors;

  function onSubmit(values: FixedCostItemFormData) {
    setServerError(null);
    startTransition(async () => {
      const res =
        mode.type === "create"
          ? await createFixedCostItemAction(values)
          : await updateFixedCostItemAction(mode.id, values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push("/custos-fixos");
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome do item" required error={errors.name?.message}>
          <Input
            {...form.register("name")}
            placeholder="Ex.: Aluguel da loja"
          />
        </Field>
        <Field label="Categoria" required>
          <Select {...form.register("category")}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Valor (R$)"
          required
          error={errors.amount?.message}
          hint="Para frequência anual, informe o valor anual — divido por 12 automaticamente no total."
        >
          <Input
            type="number"
            step="0.01"
            min="0"
            {...form.register("amount")}
          />
        </Field>
        <Field label="Frequência" required>
          <Select {...form.register("frequency")}>
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Observações">
        <Textarea
          rows={3}
          {...form.register("notes")}
          placeholder="Notas internas, vencimento, contato, etc."
        />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox id="active" {...form.register("active")} />
        <label htmlFor="active" className="text-sm text-slate-700">
          Item ativo (entra na soma do custo fixo mensal)
        </label>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/custos-fixos"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Salvando…" : mode.type === "create" ? "Criar item" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
