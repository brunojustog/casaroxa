"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import {
  enumOptions,
  PRODUCT_CATEGORY_LABEL,
  PRODUCT_STATUS_LABEL,
  PRODUCT_TYPE_LABEL,
} from "@/lib/enums";
import { productFormSchema, type ProductFormData } from "@/schemas/product.schema";
import {
  createProductAction,
  updateProductAction,
} from "@/server/actions/products";
import type {
  ProductCategory,
  ProductStatus,
  ProductType,
} from "@prisma/client";

const CATEGORIES = enumOptions(PRODUCT_CATEGORY_LABEL);
const TYPES = enumOptions(PRODUCT_TYPE_LABEL);
const STATUSES = enumOptions(PRODUCT_STATUS_LABEL);

type Mode = { type: "create" } | { type: "edit"; id: string };

type FormShape = {
  name: string;
  category: ProductCategory;
  type: ProductType;
  portionLabel: string;
  salePrice: number | string;
  /** percent input, 0..100 — schema converte para fração */
  targetCmv: number | string;
  description: string;
  notes: string;
  status: ProductStatus;
  active: boolean;
};

export type ProductFormDefaults = Partial<{
  name: string;
  category: ProductCategory;
  type: ProductType;
  portionLabel: string | null;
  salePrice: number | null;
  /** Já em fração (0..1). O form converte para percent na exibição. */
  targetCmv: number | null;
  description: string | null;
  notes: string | null;
  status: ProductStatus;
  active: boolean;
}>;

const EMPTY: FormShape = {
  name: "",
  category: "FRANGO",
  type: "SIMPLES",
  portionLabel: "",
  salePrice: "",
  targetCmv: "",
  description: "",
  notes: "",
  status: "ATIVO",
  active: true,
};

function toFormShape(d: ProductFormDefaults | undefined): FormShape {
  return {
    name: d?.name ?? EMPTY.name,
    category: d?.category ?? EMPTY.category,
    type: d?.type ?? EMPTY.type,
    portionLabel: d?.portionLabel ?? "",
    salePrice: d?.salePrice ?? "",
    targetCmv: d?.targetCmv != null ? Number((d.targetCmv * 100).toFixed(2)) : "",
    description: d?.description ?? "",
    notes: d?.notes ?? "",
    status: d?.status ?? EMPTY.status,
    active: d?.active ?? true,
  };
}

export function ProductForm({
  mode,
  defaultValues,
}: {
  mode: Mode;
  defaultValues?: ProductFormDefaults;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(productFormSchema),
    defaultValues: toFormShape(defaultValues) as unknown as ProductFormData,
  });

  const errors = form.formState.errors;

  function onSubmit(values: ProductFormData) {
    setServerError(null);
    startTransition(async () => {
      const res =
        mode.type === "create"
          ? await createProductAction(values)
          : await updateProductAction(mode.id, values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push("/produtos");
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field
          label="Nome do produto"
          htmlFor="name"
          required
          error={errors.name?.message}
          className="md:col-span-2"
        >
          <Input id="name" {...form.register("name")} placeholder="Ex.: Frango Assado Inteiro" />
        </Field>
        <Field
          label="Porção / rendimento"
          htmlFor="portionLabel"
          hint='Ex.: "1 unidade", "500g", "1 porção"'
        >
          <Input id="portionLabel" {...form.register("portionLabel")} />
        </Field>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Categoria" htmlFor="category" required error={errors.category?.message}>
          <Select id="category" {...form.register("category")}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo" htmlFor="type" required error={errors.type?.message}>
          <Select id="type" {...form.register("type")}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status operacional" htmlFor="status" required error={errors.status?.message}>
          <Select id="status" {...form.register("status")}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Preço & meta</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Preço de venda (R$)"
            htmlFor="salePrice"
            hint="Deixe em branco para marcar como sem preço."
            error={errors.salePrice?.message as string | undefined}
          >
            <Input
              id="salePrice"
              type="number"
              step="0.01"
              min="0"
              {...form.register("salePrice")}
            />
          </Field>
          <Field
            label="Meta de CMV (%)"
            htmlFor="targetCmv"
            hint="0–100. Ex.: 50 para 50%."
            error={errors.targetCmv?.message as string | undefined}
          >
            <Input
              id="targetCmv"
              type="number"
              step="0.1"
              min="0"
              max="100"
              {...form.register("targetCmv")}
            />
          </Field>
        </div>
      </section>

      <Field label="Descrição comercial" htmlFor="description">
        <Textarea id="description" rows={2} {...form.register("description")} />
      </Field>

      <Field label="Observações internas" htmlFor="notes">
        <Textarea id="notes" rows={3} {...form.register("notes")} />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox id="active" {...form.register("active")} />
        <label htmlFor="active" className="text-sm text-slate-700">
          Produto ativo (desmarcar inativa o produto)
        </label>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/produtos"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : mode.type === "create" ? "Criar produto" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
