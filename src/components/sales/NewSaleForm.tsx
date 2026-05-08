"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { SaleSource } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { SALE_SOURCE_LABEL, enumOptions } from "@/lib/enums";
import {
  saleHeaderFormSchema,
  type SaleHeaderFormData,
} from "@/schemas/sale.schema";
import { createSaleAction } from "@/server/actions/sales";

const SOURCE_OPTIONS = enumOptions(SALE_SOURCE_LABEL);

function nowLocalDateTimeValue(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

type FormShape = {
  occurredAt: string;
  source: SaleSource;
  customerName: string;
  notes: string;
};

export function NewSaleForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(saleHeaderFormSchema),
    defaultValues: {
      occurredAt: nowLocalDateTimeValue(),
      source: SaleSource.LOJA,
      customerName: "",
      notes: "",
    } as unknown as SaleHeaderFormData,
  });

  function onSubmit(values: SaleHeaderFormData) {
    setServerError(null);
    startTransition(async () => {
      const res = await createSaleAction(values);
      if (!res.ok || !res.data) {
        setServerError(res.ok ? "Erro inesperado." : res.error);
        return;
      }
      router.push(`/vendas/${res.data.id}`);
      router.refresh();
    });
  }

  const errors = form.formState.errors;
  const formAsAny = form as unknown as { register: (k: keyof FormShape) => Record<string, unknown> };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Data e hora" required error={errors.occurredAt?.message}>
          <Input type="datetime-local" {...formAsAny.register("occurredAt")} />
        </Field>
        <Field label="Origem" required>
          <Select {...formAsAny.register("source")}>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Cliente (opcional)">
        <Input {...formAsAny.register("customerName")} placeholder="Ex.: João Silva" />
      </Field>

      <Field label="Observações">
        <Textarea rows={3} {...formAsAny.register("notes")} />
      </Field>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/vendas"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Criando…" : "Criar venda"}
        </Button>
      </div>
    </form>
  );
}
