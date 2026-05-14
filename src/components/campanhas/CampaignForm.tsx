"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Users, Loader2, Tag, Info } from "lucide-react";
import { CampaignAudienceKey } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import {
  campaignFormSchema,
  type CampaignFormData,
} from "@/schemas/campaign.schema";
import {
  createCampaignAction,
  previewAudienceAction,
} from "@/server/actions/campaigns";

const AUDIENCE_OPTIONS: Array<{
  key: CampaignAudienceKey;
  label: string;
  description: string;
}> = [
  {
    key: "BIRTHDAY_MONTH",
    label: "Aniversariantes do mês",
    description: "Clientes com aniversário no mês corrente.",
  },
  {
    key: "INACTIVE_30D",
    label: "Inativos há 30 dias",
    description: "Tinham pedido confirmado, mas nada nos últimos 30 dias.",
  },
  {
    key: "RECURRING",
    label: "Recorrentes (3+ pedidos)",
    description: "Clientes com 3 ou mais pedidos concluídos.",
  },
  {
    key: "HIGH_TICKET",
    label: "Alto ticket",
    description:
      "Ticket médio acima da meta de Settings.targetAverageTicket.",
  },
  {
    key: "BOUGHT_CHICKEN",
    label: "Comprou frango",
    description: "Já comprou pelo menos 1 item da categoria Frango.",
  },
  {
    key: "BOUGHT_BEEF_RIB",
    label: "Comprou costela",
    description: "Já comprou pelo menos 1 item da categoria Costela.",
  },
];

export function CampaignForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      message:
        "Olá, {nome}! 👋 A Casa Roxa preparou uma novidade pra você. Use o cupom *{cupom}* no próximo pedido.",
      audienceKey: "INACTIVE_30D" as CampaignAudienceKey,
      couponCode: "",
      couponType: "PERCENT" as const,
      couponValue: 10,
      couponMaxUses: null,
      couponValidDays: 30,
    } as unknown as CampaignFormData,
  });

  const audienceKey = form.watch("audienceKey");
  const couponCode = form.watch("couponCode");

  const [preview, setPreview] = useState<{
    count: number;
    sample: string[];
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!audienceKey) return;
    let cancelled = false;
    setPreviewing(true);
    previewAudienceAction(audienceKey).then((res) => {
      if (cancelled) return;
      setPreviewing(false);
      if (res.ok && res.data) setPreview(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [audienceKey]);

  function onSubmit(data: CampaignFormData) {
    setServerError(null);
    startTransition(async () => {
      const res = await createCampaignAction(data);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push(`/campanhas/${res.data!.id}`);
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Identificação</h3>
        <Field
          label="Nome interno"
          required
          error={form.formState.errors.name?.message}
          hint="Só você vê. Use pra identificar (ex.: 'Aniversário maio')."
        >
          <Input {...form.register("name")} placeholder="Aniversário maio" />
        </Field>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Audiência</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {AUDIENCE_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className={
                audienceKey === opt.key
                  ? "flex cursor-pointer items-start gap-3 rounded-md border-2 border-roxa-500 bg-roxa-50/50 p-3"
                  : "flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white p-3 hover:border-roxa-200"
              }
            >
              <input
                type="radio"
                value={opt.key}
                {...form.register("audienceKey")}
                className="mt-1 h-4 w-4 accent-roxa-700"
              />
              <div>
                <p
                  className={
                    audienceKey === opt.key
                      ? "text-sm font-semibold text-roxa-900"
                      : "text-sm font-medium text-slate-800"
                  }
                >
                  {opt.label}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {opt.description}
                </p>
              </div>
            </label>
          ))}
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 inline-flex items-center gap-2 text-sm">
          {previewing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
              <span className="text-slate-500">Calculando audiência…</span>
            </>
          ) : preview ? (
            <>
              <Users className="h-3.5 w-3.5 text-roxa-700" />
              <span className="font-semibold text-slate-900">
                {preview.count}
              </span>
              <span className="text-slate-600">
                {preview.count === 1 ? "cliente elegível" : "clientes elegíveis"}
                {preview.sample.length > 0 &&
                  ` · ${preview.sample.join(", ")}${preview.count > preview.sample.length ? "…" : ""}`}
              </span>
            </>
          ) : (
            <span className="text-slate-500">Selecione uma audiência.</span>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Mensagem</h3>
        <Field
          label="Conteúdo"
          required
          error={form.formState.errors.message?.message}
          hint="Variáveis disponíveis: {nome} (primeiro nome do cliente), {cupom} (código do cupom se houver)."
        >
          <Textarea rows={5} {...form.register("message")} />
        </Field>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
          <Tag className="h-4 w-4 text-roxa-700" /> Cupom (opcional)
        </h3>
        <p className="text-xs text-slate-500 inline-flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          Se preencher código, o cupom é gerado automaticamente. Vendas que
          usarem o cupom contam como atribuídas a essa campanha.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Field label="Código">
            <Input
              {...form.register("couponCode")}
              placeholder="MAIO10"
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Tipo">
            <Select {...form.register("couponType")}>
              <option value="PERCENT">% (porcentagem)</option>
              <option value="FIXED">R$ fixo</option>
            </Select>
          </Field>
          <Field label="Valor">
            <Input
              type="number"
              step="0.01"
              min="0"
              {...form.register("couponValue", { valueAsNumber: true })}
              placeholder="10"
            />
          </Field>
          <Field label="Válido por (dias)">
            <Input
              type="number"
              min="1"
              max="365"
              {...form.register("couponValidDays", { valueAsNumber: true })}
            />
          </Field>
        </div>
        <Field
          label="Limite de usos (opcional)"
          hint="Deixe vazio pra ilimitado."
        >
          <Input
            type="number"
            min="1"
            {...form.register("couponMaxUses", { valueAsNumber: true })}
            placeholder="ilimitado"
            className="md:w-48"
          />
        </Field>
        {!couponCode && (
          <p className="text-[11px] text-slate-500 italic">
            Sem código de cupom — campanha vai sem atribuição automática de
            vendas.
          </p>
        )}
      </section>

      {serverError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          <Save className="h-3.5 w-3.5" />
          {isPending ? "Salvando…" : "Criar campanha (rascunho)"}
        </Button>
        <Link
          href="/campanhas"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancelar
        </Link>
      </div>
      <p className="text-[11px] text-slate-500">
        Campanha entra como rascunho. O disparo é manual na tela de detalhe.
      </p>
    </form>
  );
}
