"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import {
  enumOptions,
  INGREDIENT_CATEGORY_LABEL,
  INGREDIENT_UNIT_LABEL,
} from "@/lib/enums";
import { ingredientFormSchema, type IngredientFormData } from "@/schemas/ingredient.schema";
import {
  createIngredientAction,
  updateIngredientAction,
} from "@/server/actions/ingredients";
import type { IngredientCategory, IngredientUnit } from "@prisma/client";

const CATEGORIES = enumOptions(INGREDIENT_CATEGORY_LABEL);
const UNITS = enumOptions(INGREDIENT_UNIT_LABEL);

type Mode = { type: "create" } | { type: "edit"; id: string };

/**
 * Forma de armazenamento dentro do form (sem nulls; null vira "" ou undefined).
 * O Zod schema converte de volta para null/number/etc no submit.
 */
type FormShape = {
  name: string;
  category: IngredientCategory;
  unit: IngredientUnit;
  unitCost: number | string;
  packageSize: number | string;
  packagePrice: number | string;
  minStock: number | string;
  supplier: string;
  brand: string;
  notes: string;
  active: boolean;
};

export type IngredientFormDefaults = Partial<{
  name: string;
  category: IngredientCategory;
  unit: IngredientUnit;
  unitCost: number;
  packageSize: number | null;
  packagePrice: number | null;
  minStock: number | null;
  supplier: string | null;
  brand: string | null;
  notes: string | null;
  active: boolean;
}>;

const EMPTY_DEFAULTS: FormShape = {
  name: "",
  category: "OUTRO",
  unit: "UNIDADE",
  unitCost: 0,
  packageSize: "",
  packagePrice: "",
  minStock: "",
  supplier: "",
  brand: "",
  notes: "",
  active: true,
};

function toFormShape(d: IngredientFormDefaults | undefined): FormShape {
  return {
    name: d?.name ?? EMPTY_DEFAULTS.name,
    category: d?.category ?? EMPTY_DEFAULTS.category,
    unit: d?.unit ?? EMPTY_DEFAULTS.unit,
    unitCost: d?.unitCost ?? EMPTY_DEFAULTS.unitCost,
    packageSize: d?.packageSize ?? "",
    packagePrice: d?.packagePrice ?? "",
    minStock: d?.minStock ?? "",
    supplier: d?.supplier ?? "",
    brand: d?.brand ?? "",
    notes: d?.notes ?? "",
    active: d?.active ?? true,
  };
}

export function IngredientForm({
  mode,
  defaultValues,
}: {
  mode: Mode;
  defaultValues?: IngredientFormDefaults;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: toFormShape(defaultValues) as unknown as IngredientFormData,
  });

  const errors = form.formState.errors;

  function onSubmit(values: IngredientFormData) {
    setServerError(null);
    startTransition(async () => {
      const res =
        mode.type === "create"
          ? await createIngredientAction(values)
          : await updateIngredientAction(mode.id, values);

      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push("/ingredientes");
      router.refresh();
    });
  }

  function autoFillUnitCost() {
    const size = Number(form.getValues("packageSize") || 0);
    const price = Number(form.getValues("packagePrice") || 0);
    if (size > 0 && price > 0) {
      form.setValue("unitCost", Number((price / size).toFixed(4)), { shouldDirty: true });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Identificação */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome do ingrediente" htmlFor="name" required error={errors.name?.message}>
          <Input id="name" {...form.register("name")} placeholder="Ex.: Frango inteiro" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria" htmlFor="category" required error={errors.category?.message}>
            <Select id="category" {...form.register("category")}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Unidade base" htmlFor="unit" required error={errors.unit?.message}>
            <Select id="unit" {...form.register("unit")}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      {/* Custo */}
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Custo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label="Custo por unidade base (R$)"
            htmlFor="unitCost"
            required
            hint="Sempre na unidade base escolhida acima."
            error={errors.unitCost?.message as string | undefined}
          >
            <Input
              id="unitCost"
              type="number"
              step="0.0001"
              min="0"
              {...form.register("unitCost")}
            />
          </Field>

          <Field
            label="Tamanho da embalagem (opcional)"
            htmlFor="packageSize"
            hint="Quanto vem na embalagem que você compra."
          >
            <Input
              id="packageSize"
              type="number"
              step="0.0001"
              min="0"
              {...form.register("packageSize")}
            />
          </Field>

          <Field
            label="Preço da embalagem (R$)"
            htmlFor="packagePrice"
            hint="Para auto-preencher o custo unitário."
          >
            <div className="flex gap-2">
              <Input
                id="packagePrice"
                type="number"
                step="0.01"
                min="0"
                {...form.register("packagePrice")}
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={autoFillUnitCost}
                title="Calcular custo unitário"
              >
                <Calculator className="h-4 w-4" />
              </Button>
            </div>
          </Field>
        </div>
      </section>

      {/* Alerta de estoque mínimo */}
      <section>
        <Field
          label="Estoque mínimo"
          htmlFor="minStock"
          hint="Quando o saldo cai abaixo deste valor, vira alerta no dashboard. Vazio = sem alerta."
        >
          <Input
            id="minStock"
            type="number"
            step="0.0001"
            min="0"
            {...form.register("minStock")}
            placeholder="—"
          />
        </Field>
      </section>

      {/* Comercial */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Fornecedor" htmlFor="supplier">
          <Input id="supplier" {...form.register("supplier")} placeholder="Ex.: AstraPlus" />
        </Field>
        <Field label="Marca" htmlFor="brand">
          <Input id="brand" {...form.register("brand")} />
        </Field>
      </section>

      <Field label="Observações" htmlFor="notes">
        <Textarea id="notes" rows={3} {...form.register("notes")} />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox id="active" {...form.register("active")} />
        <label htmlFor="active" className="text-sm text-slate-700">
          Ingrediente ativo
        </label>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/ingredientes"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : mode.type === "create" ? "Criar ingrediente" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
