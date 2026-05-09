"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import {
  customerFormSchema,
  type CustomerFormData,
} from "@/schemas/customer.schema";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/server/actions/customers";

type Mode = { type: "create" } | { type: "edit"; id: string };

export type CustomerFormDefaults = Partial<{
  name: string;
  phone: string;
  email: string | null;
  birthday: Date | null;
  address: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  reference: string | null;
  notes: string | null;
  active: boolean;
}>;

function toIsoDate(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function CustomerForm({
  mode,
  defaultValues,
}: {
  mode: Mode;
  defaultValues?: CustomerFormDefaults;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      birthday: toIsoDate(defaultValues?.birthday),
      address: defaultValues?.address ?? "",
      addressNumber: defaultValues?.addressNumber ?? "",
      addressComplement: defaultValues?.addressComplement ?? "",
      neighborhood: defaultValues?.neighborhood ?? "",
      reference: defaultValues?.reference ?? "",
      notes: defaultValues?.notes ?? "",
      active: defaultValues?.active ?? true,
    } as unknown as CustomerFormData,
  });

  const errors = form.formState.errors;

  function onSubmit(values: CustomerFormData) {
    setServerError(null);
    startTransition(async () => {
      const res =
        mode.type === "create"
          ? await createCustomerAction(values)
          : await updateCustomerAction(mode.id, values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push("/clientes");
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome" required error={errors.name?.message}>
          <Input {...form.register("name")} placeholder="Maria Silva" />
        </Field>
        <Field
          label="Telefone (com DDD)"
          required
          error={errors.phone?.message}
          hint="Salvo só com dígitos. Aceita formatado: (11) 99999-9999."
        >
          <Input {...form.register("phone")} placeholder="(11) 99999-9999" />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="E-mail">
          <Input type="email" {...form.register("email")} />
        </Field>
        <Field label="Aniversário">
          <Input type="date" {...form.register("birthday")} />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Endereço (rua)" className="md:col-span-2">
          <Input {...form.register("address")} placeholder="Rua das Flores" />
        </Field>
        <Field label="Número">
          <Input {...form.register("addressNumber")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Bairro">
          <Input {...form.register("neighborhood")} />
        </Field>
        <Field label="Complemento">
          <Input {...form.register("addressComplement")} />
        </Field>
      </div>
      <Field label="Ponto de referência">
        <Input {...form.register("reference")} />
      </Field>

      <Field label="Observações internas">
        <Textarea
          rows={2}
          {...form.register("notes")}
          placeholder="Ex.: cliente preferencial, sem pimenta, etc."
        />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox id="active" {...form.register("active")} />
        <label htmlFor="active" className="text-sm text-slate-700">
          Cliente ativo
        </label>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/clientes"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending
            ? "Salvando…"
            : mode.type === "create"
              ? "Criar cliente"
              : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
