"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import {
  inventoryCreateSchema,
  type InventoryCreateData,
} from "@/schemas/inventory.schema";
import { createInventoryAction } from "@/server/actions/inventories";

export function InventoryCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const today = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const form = useForm({
    resolver: zodResolver(inventoryCreateSchema),
    defaultValues: {
      name: `Contagem — ${today}`,
      notes: "",
      populateAllActive: true,
    } as unknown as InventoryCreateData,
  });

  const errors = form.formState.errors;

  function onSubmit(values: InventoryCreateData) {
    setServerError(null);
    startTransition(async () => {
      const res = await createInventoryAction(values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      if (res.data?.id) {
        router.push(`/inventarios/${res.data.id}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Field label="Nome da contagem" required error={errors.name?.message}>
        <Input {...form.register("name")} placeholder="Ex.: Inventário mensal — maio/26" />
      </Field>

      <Field label="Observações">
        <Textarea
          rows={3}
          {...form.register("notes")}
          placeholder="Opcional. Ex.: contagem de fim de mês, conferida com Maria."
        />
      </Field>

      <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
        <Checkbox
          id="populateAllActive"
          {...form.register("populateAllActive")}
          className="mt-0.5"
        />
        <label htmlFor="populateAllActive" className="text-sm text-slate-700">
          <span className="font-medium">Preencher com todos os ingredientes ativos</span>
          <p className="text-xs text-slate-500 mt-0.5">
            Recomendado pra contagem completa. O sistema fotografa o saldo atual de cada
            ingrediente. Se desmarcar, abre vazio e você adiciona os ingredientes que vai contar.
          </p>
        </label>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/inventarios"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Criando…" : "Criar contagem"}
        </Button>
      </div>
    </form>
  );
}
