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
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import {
  COUPON_TYPES,
  couponFormSchema,
  type CouponFormData,
} from "@/schemas/coupon.schema";
import {
  createCouponAction,
  updateCouponAction,
} from "@/server/actions/coupons";
import type { CouponType } from "@prisma/client";

type Mode = { type: "create" } | { type: "edit"; id: string };

export type CouponFormDefaults = Partial<{
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  maxUses: number | null;
  minOrderAmount: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
  active: boolean;
}>;

const TYPE_LABEL: Record<(typeof COUPON_TYPES)[number], string> = {
  PERCENT: "Percentual (% off)",
  FIXED: "Valor fixo (R$)",
};

function toLocalInput(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function CouponForm({
  mode,
  defaultValues,
}: {
  mode: Mode;
  defaultValues?: CouponFormDefaults;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(couponFormSchema),
    defaultValues: {
      code: defaultValues?.code ?? "",
      description: defaultValues?.description ?? "",
      type: defaultValues?.type ?? ("PERCENT" as CouponType),
      value: defaultValues?.value ?? 10,
      maxUses: defaultValues?.maxUses ?? "",
      minOrderAmount: defaultValues?.minOrderAmount ?? "",
      validFrom: toLocalInput(defaultValues?.validFrom),
      validUntil: toLocalInput(defaultValues?.validUntil),
      active: defaultValues?.active ?? true,
    } as unknown as CouponFormData,
  });

  const errors = form.formState.errors;
  const watchType = form.watch("type");

  function onSubmit(values: CouponFormData) {
    setServerError(null);
    startTransition(async () => {
      const res =
        mode.type === "create"
          ? await createCouponAction(values)
          : await updateCouponAction(mode.id, values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push("/cupons");
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Field
        label="Código"
        required
        error={errors.code?.message}
        hint="Letras, números, '-' e '_'. Será convertido pra MAIÚSCULAS automaticamente."
      >
        <Input
          {...form.register("code")}
          placeholder="MAIO10"
          className="font-mono uppercase"
          autoComplete="off"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Tipo de desconto" required>
          <Select {...form.register("type")}>
            {COUPON_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={watchType === "PERCENT" ? "Percentual (%)" : "Valor (R$)"}
          required
          error={errors.value?.message}
          hint={
            watchType === "PERCENT" ? "0 a 100" : "Ex.: 5 = R$ 5,00 de desconto"
          }
        >
          <Input
            type="number"
            step={watchType === "PERCENT" ? "1" : "0.01"}
            min="0"
            max={watchType === "PERCENT" ? "100" : undefined}
            {...form.register("value")}
          />
        </Field>
        <Field
          label="Pedido mínimo (R$)"
          hint="Subtotal mínimo pra cupom valer. Vazio = sem mínimo."
        >
          <Input
            type="number"
            step="0.01"
            min="0"
            {...form.register("minOrderAmount")}
            placeholder="—"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field
          label="Limite de usos"
          hint="Quantas vezes o cupom pode ser usado no total. Vazio = ilimitado."
        >
          <Input
            type="number"
            step="1"
            min="1"
            {...form.register("maxUses")}
            placeholder="—"
          />
        </Field>
        <Field label="Válido a partir de" hint="Opcional">
          <Input type="datetime-local" {...form.register("validFrom")} />
        </Field>
        <Field
          label="Válido até"
          error={errors.validUntil?.message}
          hint="Opcional"
        >
          <Input type="datetime-local" {...form.register("validUntil")} />
        </Field>
      </div>

      <Field label="Descrição (opcional)" hint="Aparece só pra você.">
        <Textarea
          rows={2}
          {...form.register("description")}
          placeholder="Ex.: Promoção mês de maio — divulgada no Insta"
        />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox id="active" {...form.register("active")} />
        <label htmlFor="active" className="text-sm text-slate-700">
          Cupom ativo
        </label>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/cupons"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending
            ? "Salvando…"
            : mode.type === "create"
              ? "Criar cupom"
              : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
