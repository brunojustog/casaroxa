"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Save,
  Plus,
  Trash2,
  Package,
  Clock,
} from "lucide-react";
import {
  SalesEventStatus,
  SalesEventWindowKind,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import {
  salesEventFormSchema,
  type SalesEventFormData,
} from "@/schemas/sales-event.schema";
import {
  createSalesEventAction,
  updateSalesEventAction,
} from "@/server/actions/sales-events";

type Mode = { type: "create" } | { type: "edit"; id: string };

export type SalesEventFormDefaults = Partial<{
  name: string;
  eventDate: Date;
  description: string | null;
  opensAt: Date;
  closesAt: Date;
  reservationTimeoutMinutes: number;
  products: Array<{
    productId?: string | null;
    comboId?: string | null;
    quantityLimit: number;
    unitPriceCents?: number | null;
    displayOrder: number;
  }>;
  windows: Array<{
    kind: SalesEventWindowKind;
    label: string;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    displayOrder: number;
  }>;
  status: SalesEventStatus;
}>;

function toLocalInput(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function SalesEventForm({
  mode,
  defaultValues,
  catalog,
}: {
  mode: Mode;
  defaultValues?: SalesEventFormDefaults;
  catalog: {
    products: Array<{ id: string; name: string; salePrice: number }>;
    combos: Array<{ id: string; name: string; salePrice: number }>;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  const form = useForm({
    resolver: zodResolver(salesEventFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      eventDate: toDateInput(defaultValues?.eventDate ?? inDays(5)),
      description: defaultValues?.description ?? "",
      opensAt: toLocalInput(defaultValues?.opensAt ?? now),
      closesAt: toLocalInput(defaultValues?.closesAt ?? inDays(3)),
      reservationTimeoutMinutes:
        defaultValues?.reservationTimeoutMinutes ?? 120,
      products: defaultValues?.products ?? [
        { productId: null, comboId: null, quantityLimit: 10, unitPriceCents: null, displayOrder: 0 },
      ],
      windows: defaultValues?.windows ?? [
        {
          kind: "PICKUP" as SalesEventWindowKind,
          label: "Sábado 11h às 12h",
          startsAt: toLocalInput(inDays(5)),
          endsAt: toLocalInput(inDays(5)),
          capacity: 10,
          displayOrder: 0,
        },
      ],
      status: defaultValues?.status ?? "DRAFT",
    } as unknown as SalesEventFormData,
  });

  const products = useFieldArray({ control: form.control, name: "products" });
  const windows = useFieldArray({ control: form.control, name: "windows" });

  const errors = form.formState.errors;

  function onSubmit(values: SalesEventFormData) {
    setServerError(null);
    startTransition(async () => {
      const res =
        mode.type === "create"
          ? await createSalesEventAction(values)
          : await updateSalesEventAction(mode.id, values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push(
        mode.type === "create"
          ? `/pre-vendas/${res.data?.id}`
          : "/pre-vendas",
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <Field label="Nome" required error={errors.name?.message}>
        <Input
          {...form.register("name")}
          placeholder="Almoço Sábado - Dia das Mães"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Data do evento" required error={errors.eventDate?.message}>
          <Input type="date" {...form.register("eventDate")} />
        </Field>
        <Field
          label="Timeout das reservas (min)"
          hint="Quanto tempo o pedido segura a vaga até precisar pagar"
          error={errors.reservationTimeoutMinutes?.message}
        >
          <Input
            type="number"
            min={15}
            max={1440}
            step={15}
            {...form.register("reservationTimeoutMinutes", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <Field label="Descrição" hint="Texto livre exibido ao cliente. Opcional.">
        <Textarea rows={2} {...form.register("description")} />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Abre em" required>
          <Input type="datetime-local" {...form.register("opensAt")} />
        </Field>
        <Field
          label="Fecha em"
          required
          hint="Cliente não pode mais pedir depois deste momento"
          error={errors.closesAt?.message}
        >
          <Input type="datetime-local" {...form.register("closesAt")} />
        </Field>
      </div>

      {/* Produtos */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 font-medium text-slate-900">
            <Package className="h-4 w-4 text-roxa-700" />
            Produtos disponíveis na pré-venda
            <span className="text-xs text-slate-500">
              ({products.fields.length})
            </span>
          </h3>
          <button
            type="button"
            onClick={() =>
              products.append({
                productId: null,
                comboId: null,
                quantityLimit: 10,
                unitPriceCents: null,
                displayOrder: products.fields.length,
              })
            }
            className="inline-flex items-center gap-1 rounded-md bg-roxa-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-roxa-800"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar item
          </button>
        </div>
        {errors.products && typeof errors.products.message === "string" && (
          <p className="text-xs text-red-600">{errors.products.message}</p>
        )}
        <div className="space-y-2">
          {products.fields.map((f, i) => (
            <ProductRow
              key={f.id}
              index={i}
              form={form}
              onRemove={() => products.remove(i)}
              canRemove={products.fields.length > 1}
              catalog={catalog}
              errorMsg={
                errors.products?.[i]?.quantityLimit?.message ??
                (errors.products?.[i] as { message?: string } | undefined)
                  ?.message
              }
            />
          ))}
        </div>
      </div>

      {/* Janelas */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 font-medium text-slate-900">
            <Clock className="h-4 w-4 text-roxa-700" />
            Janelas de retirada/entrega
            <span className="text-xs text-slate-500">
              ({windows.fields.length})
            </span>
          </h3>
          <button
            type="button"
            onClick={() =>
              windows.append({
                kind: "PICKUP",
                label: "",
                startsAt: toLocalInput(inDays(5)) as unknown as Date,
                endsAt: toLocalInput(inDays(5)) as unknown as Date,
                capacity: 10,
                displayOrder: windows.fields.length,
              })
            }
            className="inline-flex items-center gap-1 rounded-md bg-roxa-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-roxa-800"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar janela
          </button>
        </div>
        {errors.windows && typeof errors.windows.message === "string" && (
          <p className="text-xs text-red-600">{errors.windows.message}</p>
        )}
        <div className="space-y-2">
          {windows.fields.map((f, i) => (
            <div
              key={f.id}
              className="grid grid-cols-12 gap-2 items-start rounded-md border border-slate-200 bg-white p-2"
            >
              <div className="col-span-3">
                <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
                  Tipo
                </label>
                <Select {...form.register(`windows.${i}.kind`)}>
                  <option value="PICKUP">Retirada</option>
                  <option value="DELIVERY">Entrega</option>
                </Select>
              </div>
              <div className="col-span-9">
                <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
                  Rótulo
                </label>
                <Input
                  {...form.register(`windows.${i}.label`)}
                  placeholder="Sáb 11h às 12h"
                />
              </div>
              <div className="col-span-5">
                <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
                  Início
                </label>
                <Input
                  type="datetime-local"
                  {...form.register(`windows.${i}.startsAt`)}
                />
              </div>
              <div className="col-span-5">
                <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
                  Fim
                </label>
                <Input
                  type="datetime-local"
                  {...form.register(`windows.${i}.endsAt`)}
                />
                {errors.windows?.[i]?.endsAt?.message && (
                  <p className="text-[11px] text-red-600 mt-0.5">
                    {errors.windows[i]?.endsAt?.message}
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
                  Capacidade
                </label>
                <Input
                  type="number"
                  min={0}
                  {...form.register(`windows.${i}.capacity`, { valueAsNumber: true })}
                  title="0 = ilimitada"
                />
              </div>
              {windows.fields.length > 1 && (
                <div className="col-span-12 -mt-1">
                  <button
                    type="button"
                    onClick={() => windows.remove(i)}
                    className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Remover janela
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Field
        label="Status"
        hint="Mantenha em Rascunho enquanto monta. Abra quando estiver pronto pra clientes."
      >
        <Select {...form.register("status")}>
          <option value="DRAFT">Rascunho (não público)</option>
          <option value="OPEN">Aberto (aceitando pedidos)</option>
          <option value="CLOSED">Fechado (não aceita novos pedidos)</option>
          <option value="CANCELLED">Cancelado</option>
        </Select>
      </Field>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
        <Link
          href="/pre-vendas"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending
            ? "Salvando…"
            : mode.type === "create"
              ? "Criar pré-venda"
              : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function ProductRow({
  index,
  form,
  onRemove,
  canRemove,
  catalog,
  errorMsg,
}: {
  index: number;
  form: ReturnType<typeof useForm<SalesEventFormData>>;
  onRemove: () => void;
  canRemove: boolean;
  catalog: {
    products: Array<{ id: string; name: string; salePrice: number }>;
    combos: Array<{ id: string; name: string; salePrice: number }>;
  };
  errorMsg?: string;
}) {
  // Combinado: { kind:"P"|"C", id } via string única no select
  const productId = form.watch(`products.${index}.productId`);
  const comboId = form.watch(`products.${index}.comboId`);
  const value = productId ? `P:${productId}` : comboId ? `C:${comboId}` : "";

  return (
    <div className="grid grid-cols-12 gap-2 items-start rounded-md border border-slate-200 bg-white p-2">
      <div className="col-span-6">
        <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
          Produto / Combo
        </label>
        <Select
          value={value}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (!v) {
              form.setValue(`products.${index}.productId`, null);
              form.setValue(`products.${index}.comboId`, null);
              return;
            }
            const [kind, id] = v.split(":");
            if (kind === "P") {
              form.setValue(`products.${index}.productId`, id);
              form.setValue(`products.${index}.comboId`, null);
            } else {
              form.setValue(`products.${index}.productId`, null);
              form.setValue(`products.${index}.comboId`, id);
            }
          }}
        >
          <option value="">Selecione…</option>
          <optgroup label="Produtos">
            {catalog.products.map((p) => (
              <option key={p.id} value={`P:${p.id}`}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Combos">
            {catalog.combos.map((c) => (
              <option key={c.id} value={`C:${c.id}`}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </Select>
      </div>
      <div className="col-span-3">
        <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
          Limite
        </label>
        <Input
          type="number"
          min={1}
          {...form.register(`products.${index}.quantityLimit`, {
            valueAsNumber: true,
          })}
        />
      </div>
      <div className="col-span-3">
        <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
          Preço override (R$)
        </label>
        <Input
          type="number"
          step="0.01"
          min={0}
          placeholder="padrão"
          {...form.register(`products.${index}.unitPriceCents`, {
            setValueAs: (v: unknown) => {
              if (v === "" || v === null || v === undefined) return null;
              const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
              return isFinite(n) ? Math.round(n * 100) : null;
            },
          })}
        />
      </div>
      {errorMsg && (
        <p className="col-span-12 text-[11px] text-red-600">{errorMsg}</p>
      )}
      {canRemove && (
        <div className="col-span-12 -mt-1">
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" /> Remover
          </button>
        </div>
      )}
    </div>
  );
}
