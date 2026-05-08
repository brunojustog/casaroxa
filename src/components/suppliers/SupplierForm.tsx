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
  supplierFormSchema,
  type SupplierFormData,
} from "@/schemas/supplier.schema";
import {
  createSupplierAction,
  updateSupplierAction,
} from "@/server/actions/suppliers";

type Mode = { type: "create" } | { type: "edit"; id: string };

export type SupplierFormDefaults = Partial<{
  name: string;
  cnpj: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
}>;

type FormShape = {
  name: string;
  cnpj: string;
  contactPerson: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
};

function toFormShape(d: SupplierFormDefaults | undefined): FormShape {
  return {
    name: d?.name ?? "",
    cnpj: d?.cnpj ?? "",
    contactPerson: d?.contactPerson ?? "",
    phone: d?.phone ?? "",
    email: d?.email ?? "",
    notes: d?.notes ?? "",
    active: d?.active ?? true,
  };
}

export function SupplierForm({
  mode,
  defaultValues,
}: {
  mode: Mode;
  defaultValues?: SupplierFormDefaults;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: toFormShape(defaultValues) as unknown as SupplierFormData,
  });

  const errors = form.formState.errors;

  function onSubmit(values: SupplierFormData) {
    setServerError(null);
    startTransition(async () => {
      const res =
        mode.type === "create"
          ? await createSupplierAction(values)
          : await updateSupplierAction(mode.id, values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push("/fornecedores");
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome do fornecedor" required error={errors.name?.message}>
          <Input {...form.register("name")} placeholder="Ex.: AstraPlus" />
        </Field>
        <Field label="CNPJ">
          <Input {...form.register("cnpj")} placeholder="00.000.000/0000-00" />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Pessoa de contato">
          <Input {...form.register("contactPerson")} />
        </Field>
        <Field label="Telefone">
          <Input {...form.register("phone")} placeholder="(11) 99999-9999" />
        </Field>
        <Field label="E-mail">
          <Input type="email" {...form.register("email")} />
        </Field>
      </div>

      <Field label="Observações">
        <Textarea rows={3} {...form.register("notes")} />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox id="active" {...form.register("active")} />
        <label htmlFor="active" className="text-sm text-slate-700">
          Fornecedor ativo
        </label>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/fornecedores"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Salvando…" : mode.type === "create" ? "Criar fornecedor" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
