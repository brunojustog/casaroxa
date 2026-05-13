"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import {
  adminOrderRequestSchema,
  type AdminOrderRequestData,
} from "@/schemas/order-request.schema";
import { createAdminOrderRequestAction } from "@/server/actions/order-requests";

function toLocalInput(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OrderRequestForm({
  catalog,
}: {
  catalog: {
    products: Array<{ id: string; name: string; salePrice: number }>;
    combos: Array<{ id: string; name: string; salePrice: number }>;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const tomorrow18h = new Date();
  tomorrow18h.setDate(tomorrow18h.getDate() + 2);
  tomorrow18h.setHours(18, 0, 0, 0);

  const form = useForm({
    resolver: zodResolver(adminOrderRequestSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      requestedFor: toLocalInput(tomorrow18h),
      deliveryMode: "PICKUP" as const,
      address: "",
      addressNumber: "",
      addressComplement: "",
      neighborhood: "",
      reference: "",
      notes: "",
      items: [{ productId: null, comboId: null, quantity: 1 }],
    } as unknown as AdminOrderRequestData,
  });

  const items = useFieldArray({ control: form.control, name: "items" });
  const deliveryMode = form.watch("deliveryMode");

  function onSubmit(data: AdminOrderRequestData) {
    setServerError(null);
    startTransition(async () => {
      const res = await createAdminOrderRequestAction(data);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push(`/encomendas/${res.data!.id}`);
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      {/* Cliente */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Cliente</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Nome completo" required error={form.formState.errors.customerName?.message}>
            <Input
              {...form.register("customerName")}
              placeholder="João da Silva"
            />
          </Field>
          <Field label="Telefone (com DDD)" required error={form.formState.errors.customerPhone?.message}>
            <Input
              {...form.register("customerPhone")}
              placeholder="(11) 99999-9999"
              inputMode="tel"
            />
          </Field>
        </div>
      </section>

      {/* Data e modalidade */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Quando e como</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Data e hora desejada" required error={form.formState.errors.requestedFor?.message as string | undefined}>
            <Input type="datetime-local" {...form.register("requestedFor")} />
          </Field>
          <Field label="Modalidade" required>
            <Select {...form.register("deliveryMode")}>
              <option value="PICKUP">Retirada no local</option>
              <option value="DELIVERY">Delivery</option>
            </Select>
          </Field>
        </div>
        {deliveryMode === "DELIVERY" && (
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Endereço (rua)" required className="md:col-span-2" error={form.formState.errors.address?.message}>
                <Input {...form.register("address")} placeholder="Rua das Flores" />
              </Field>
              <Field label="Número">
                <Input {...form.register("addressNumber")} placeholder="123" />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Bairro" required error={form.formState.errors.neighborhood?.message}>
                <Input {...form.register("neighborhood")} placeholder="Centro" />
              </Field>
              <Field label="Complemento">
                <Input {...form.register("addressComplement")} placeholder="Apto 12" />
              </Field>
            </div>
            <Field label="Ponto de referência">
              <Input {...form.register("reference")} placeholder="Próximo à praça" />
            </Field>
          </div>
        )}
      </section>

      {/* Items */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Itens encomendados</h3>
          <button
            type="button"
            onClick={() =>
              items.append({ productId: null, comboId: null, quantity: 1 })
            }
            className="inline-flex items-center gap-1 rounded-md border border-roxa-300 bg-white px-2 py-1 text-xs font-medium text-roxa-700 hover:bg-roxa-50"
          >
            <Plus className="h-3 w-3" /> Adicionar item
          </button>
        </div>
        {items.fields.map((field, i) => (
          <ItemRow
            key={field.id}
            index={i}
            form={form}
            catalog={catalog}
            onRemove={() => items.remove(i)}
            canRemove={items.fields.length > 1}
          />
        ))}
        {form.formState.errors.items?.message && (
          <p className="text-xs text-red-600">
            {form.formState.errors.items.message as string}
          </p>
        )}
      </section>

      {/* Observações */}
      <Field label="Observações">
        <Textarea
          rows={3}
          {...form.register("notes")}
          placeholder="Pimenta, troca, observações do cliente..."
        />
      </Field>

      {serverError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          <Save className="h-3.5 w-3.5" />
          {isPending ? "Salvando…" : "Criar encomenda"}
        </Button>
        <Link
          href="/encomendas"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

type FormType = ReturnType<typeof useForm<AdminOrderRequestData>>;

function ItemRow({
  index,
  form,
  catalog,
  onRemove,
  canRemove,
}: {
  index: number;
  form: FormType;
  catalog: {
    products: Array<{ id: string; name: string; salePrice: number }>;
    combos: Array<{ id: string; name: string; salePrice: number }>;
  };
  onRemove: () => void;
  canRemove: boolean;
}) {
  // Combina produtos + combos num só select com prefixo P:/C: pra distinguir
  const productId = form.watch(`items.${index}.productId`);
  const comboId = form.watch(`items.${index}.comboId`);
  const current = productId ? `P:${productId}` : comboId ? `C:${comboId}` : "";

  function onSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.currentTarget.value;
    if (!v) {
      form.setValue(`items.${index}.productId`, null);
      form.setValue(`items.${index}.comboId`, null);
      return;
    }
    if (v.startsWith("P:")) {
      form.setValue(`items.${index}.productId`, v.slice(2));
      form.setValue(`items.${index}.comboId`, null);
    } else if (v.startsWith("C:")) {
      form.setValue(`items.${index}.productId`, null);
      form.setValue(`items.${index}.comboId`, v.slice(2));
    }
  }

  return (
    <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-end rounded-md border border-slate-200 bg-white p-3">
      <Field label={index === 0 ? "Produto ou combo" : undefined}>
        <Select value={current} onChange={onSelect}>
          <option value="">— selecione —</option>
          <optgroup label="Produtos">
            {catalog.products.map((p) => (
              <option key={p.id} value={`P:${p.id}`}>
                {p.name} —{" "}
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(p.salePrice)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Combos">
            {catalog.combos.map((c) => (
              <option key={c.id} value={`C:${c.id}`}>
                {c.name} —{" "}
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(c.salePrice)}
              </option>
            ))}
          </optgroup>
        </Select>
      </Field>
      <Field label={index === 0 ? "Qtd" : undefined}>
        <Input
          type="number"
          min={1}
          {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
        />
      </Field>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
        aria-label="Remover item"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
