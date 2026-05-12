"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { RaffleStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import {
  raffleFormSchema,
  type RaffleFormData,
} from "@/schemas/raffle.schema";
import {
  createRaffleAction,
  updateRaffleAction,
} from "@/server/actions/raffles";

type Mode = { type: "create" } | { type: "edit"; id: string };

export type RaffleFormDefaults = Partial<{
  name: string;
  prizeDescription: string | null;
  imageUrl: string | null;
  opensAt: Date;
  closesAt: Date;
  drawAt: Date | null;
  ticketPriceCents: number;
  totalNumbers: number;
  maxTicketsPerCustomer: number | null;
  status: RaffleStatus;
}>;

function toLocalInput(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RaffleForm({
  mode,
  defaultValues,
}: {
  mode: Mode;
  defaultValues?: RaffleFormDefaults;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  // Default: opensAt agora, closesAt em 7 dias, drawAt em 8 dias
  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  const form = useForm({
    resolver: zodResolver(raffleFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      prizeDescription: defaultValues?.prizeDescription ?? "",
      imageUrl: defaultValues?.imageUrl ?? "",
      opensAt: toLocalInput(defaultValues?.opensAt ?? now),
      closesAt: toLocalInput(defaultValues?.closesAt ?? inDays(7)),
      drawAt: toLocalInput(defaultValues?.drawAt ?? inDays(8)),
      ticketPriceCents: defaultValues?.ticketPriceCents ?? 0,
      totalNumbers: defaultValues?.totalNumbers ?? 100,
      maxTicketsPerCustomer: defaultValues?.maxTicketsPerCustomer ?? null,
      status: defaultValues?.status ?? "DRAFT",
    } as unknown as RaffleFormData,
  });

  const errors = form.formState.errors;

  function onSubmit(values: RaffleFormData) {
    setServerError(null);
    startTransition(async () => {
      const res =
        mode.type === "create"
          ? await createRaffleAction(values)
          : await updateRaffleAction(mode.id, values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push(
        mode.type === "create"
          ? `/sorteios/${res.data?.id}`
          : "/sorteios",
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Nome do sorteio" required error={errors.name?.message}>
        <Input
          {...form.register("name")}
          placeholder="Combo Família — Maio/26"
        />
      </Field>

      <Field
        label="Descrição do prêmio"
        hint="Texto livre — aparece na landing pública. Você entrega manualmente após o sorteio."
      >
        <Textarea
          rows={3}
          {...form.register("prizeDescription")}
          placeholder="1 Combo Família com 4 acompanhamentos, à escolha do ganhador."
        />
      </Field>

      <Field label="URL da imagem (banner do prêmio)" hint="Opcional">
        <Input {...form.register("imageUrl")} placeholder="https://..." />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Abertura" required>
          <Input type="datetime-local" {...form.register("opensAt")} />
        </Field>
        <Field
          label="Encerramento"
          required
          error={errors.closesAt?.message}
          hint="Último momento pra entrar"
        >
          <Input type="datetime-local" {...form.register("closesAt")} />
        </Field>
        <Field
          label="Sorteio (informativo)"
          error={errors.drawAt?.message}
          hint="Data prevista (sorteio é manual)"
        >
          <Input type="datetime-local" {...form.register("drawAt")} />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field
          label="Total de números"
          required
          hint="Tamanho do pool (1..N)"
          error={errors.totalNumbers?.message}
        >
          <Input
            type="number"
            min="1"
            max="10000"
            step="1"
            {...form.register("totalNumbers", { valueAsNumber: true })}
          />
        </Field>
        <Field
          label="Limite por cliente"
          hint="Vazio = sem limite"
          error={errors.maxTicketsPerCustomer?.message}
        >
          <Input
            type="number"
            min="1"
            step="1"
            placeholder="Sem limite"
            {...form.register("maxTicketsPerCustomer", {
              setValueAs: (v: unknown) => {
                if (v === "" || v === null || v === undefined) return null;
                const n = Number(v);
                return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
              },
            })}
          />
        </Field>
        <Field
          label="Valor por número (R$)"
          hint="0 = gratuito"
          error={errors.ticketPriceCents?.message}
        >
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            {...form.register("ticketPriceCents", {
              setValueAs: (v: unknown) => {
                if (v === "" || v === null || v === undefined) return 0;
                const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
                return Math.round((isFinite(n) ? n : 0) * 100);
              },
            })}
            defaultValue={
              defaultValues?.ticketPriceCents
                ? (defaultValues.ticketPriceCents / 100).toFixed(2)
                : "0"
            }
          />
        </Field>
      </div>

      <Field
        label="Status"
        hint="Mantenha em Rascunho até estar pronto. Mude pra Aberto pra começar a aceitar inscrições."
      >
        <Select {...form.register("status")}>
          <option value="DRAFT">Rascunho (não público)</option>
          <option value="OPEN">Aberto (aceitando inscrições)</option>
          <option value="CLOSED">Encerrado (não aceita mais)</option>
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
          href="/sorteios"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending
            ? "Salvando…"
            : mode.type === "create"
              ? "Criar sorteio"
              : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
