"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Save,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  PowerOff,
  QrCode,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ConnectWhatsAppDialog } from "./ConnectWhatsAppDialog";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import { updateSettingsAction } from "@/server/actions/settings";
import { ImageUploadField } from "@/components/admin/upload/ImageUploadField";

type Defaults = {
  businessName: string;
  fixedMonthlyCost: number;
  investedAmount: number;
  plannedInvestment: number;
  targetAverageTicket: number;
  targetOrdersPerWeekend: number;
  weekendsPerMonth: number;
  defaultCmvChicken: number;
  defaultCmvBeefRib: number;
  defaultCmvPork: number;
  defaultCmvSides: number;
  defaultCmvExtras: number;
  defaultCmvBeverages: number;
  defaultCmvCombos: number;
  cardFeePercent: number;
  appFeePercent: number;
  beefRibLossPercent: number;
  porkRibLossPercent: number;
  pancetaLossPercent: number;
  porkLoinLossPercent: number;
  // Cardápio online
  siteSlogan: string | null;
  whatsappNumber: string | null;
  address: string | null;
  addressNeighborhood: string | null;
  openingHours: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  emporioWhatsappGroupUrl: string | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFeeNote: string | null;
  minimumOrderValue: number | null;
  // Promoção em destaque (hero da landing)
  heroPromoTitle: string | null;
  heroPromoText: string | null;
  heroPromoImageUrl: string | null;
  heroPromoLinkLabel: string | null;
  heroPromoLinkHref: string | null;
  // WhatsApp API (wuzapi)
  whatsappApiEnabled: boolean;
  whatsappNotifyConfirmed: boolean;
  whatsappNotifyReady: boolean;
  whatsappNotifyOnDelivery: boolean;
  whatsappNotifyBirthday: boolean;
  whatsappNotifyLoyaltyRedeem: boolean;
  whatsappNotifyPaymentReceived: boolean;
  whatsappNotifyOrderRequestReceived: boolean;
  whatsappNotifyOrderRequestApproved: boolean;
  whatsappNotifyOrderRequestRejected: boolean;
  whatsappNotifyOrderRequestReady: boolean;
  whatsappNotifyNpsRequest: boolean;
  whatsappNotifyAbandonedCart: boolean;
  abandonedCartNotifyAfterMinutes: number;
  // Pagamento online (Asaas)
  asaasEnabled: boolean;
  asaasPaymentTtlHours: number;
  // Horário da cozinha (agendamento no checkout)
  kitchenScheduleEnabled: boolean;
  kitchenSatOpen: string;
  kitchenSatClose: string;
  kitchenSunOpen: string;
  kitchenSunClose: string;
};

const FACTORY_DEFAULTS: Defaults = {
  businessName: "Casa Roxa Assados",
  fixedMonthlyCost: 1500,
  investedAmount: 5000,
  plannedInvestment: 5000,
  targetAverageTicket: 75,
  targetOrdersPerWeekend: 100,
  weekendsPerMonth: 4,
  defaultCmvChicken: 0.5,
  defaultCmvBeefRib: 0.5,
  defaultCmvPork: 0.5,
  defaultCmvSides: 0.35,
  defaultCmvExtras: 0.35,
  defaultCmvBeverages: 0.7,
  defaultCmvCombos: 0.45,
  cardFeePercent: 0,
  appFeePercent: 0,
  beefRibLossPercent: 0.35,
  porkRibLossPercent: 0.3,
  pancetaLossPercent: 0.3,
  porkLoinLossPercent: 0.25,
  siteSlogan: null,
  whatsappNumber: null,
  address: null,
  addressNeighborhood: null,
  openingHours: null,
  instagramUrl: null,
  facebookUrl: null,
  emporioWhatsappGroupUrl: null,
  pickupEnabled: true,
  deliveryEnabled: true,
  deliveryFeeNote: null,
  minimumOrderValue: null,
  heroPromoTitle: null,
  heroPromoText: null,
  heroPromoImageUrl: null,
  heroPromoLinkLabel: null,
  heroPromoLinkHref: null,
  whatsappApiEnabled: false,
  whatsappNotifyConfirmed: false,
  whatsappNotifyReady: false,
  whatsappNotifyOnDelivery: false,
  whatsappNotifyBirthday: false,
  whatsappNotifyLoyaltyRedeem: false,
  whatsappNotifyPaymentReceived: false,
  whatsappNotifyOrderRequestReceived: false,
  whatsappNotifyOrderRequestApproved: false,
  whatsappNotifyOrderRequestRejected: false,
  whatsappNotifyOrderRequestReady: false,
  whatsappNotifyNpsRequest: false,
  whatsappNotifyAbandonedCart: false,
  abandonedCartNotifyAfterMinutes: 30,
  asaasEnabled: false,
  asaasPaymentTtlHours: 24,
  kitchenScheduleEnabled: true,
  kitchenSatOpen: "07:00",
  kitchenSatClose: "14:00",
  kitchenSunOpen: "07:00",
  kitchenSunClose: "13:00",
};

function toState(d: Defaults) {
  return {
    businessName: d.businessName,
    investedAmount: String(d.investedAmount),
    plannedInvestment: String(d.plannedInvestment),
    targetAverageTicket: String(d.targetAverageTicket),
    targetOrdersPerWeekend: String(d.targetOrdersPerWeekend),
    weekendsPerMonth: String(d.weekendsPerMonth),
    defaultCmvChicken: String(d.defaultCmvChicken * 100),
    defaultCmvBeefRib: String(d.defaultCmvBeefRib * 100),
    defaultCmvPork: String(d.defaultCmvPork * 100),
    defaultCmvSides: String(d.defaultCmvSides * 100),
    defaultCmvExtras: String(d.defaultCmvExtras * 100),
    defaultCmvBeverages: String(d.defaultCmvBeverages * 100),
    defaultCmvCombos: String(d.defaultCmvCombos * 100),
    cardFeePercent: String(d.cardFeePercent * 100),
    appFeePercent: String(d.appFeePercent * 100),
    beefRibLossPercent: String(d.beefRibLossPercent * 100),
    porkRibLossPercent: String(d.porkRibLossPercent * 100),
    pancetaLossPercent: String(d.pancetaLossPercent * 100),
    porkLoinLossPercent: String(d.porkLoinLossPercent * 100),
    siteSlogan: d.siteSlogan ?? "",
    whatsappNumber: d.whatsappNumber ?? "",
    address: d.address ?? "",
    addressNeighborhood: d.addressNeighborhood ?? "",
    openingHours: d.openingHours ?? "",
    instagramUrl: d.instagramUrl ?? "",
    facebookUrl: d.facebookUrl ?? "",
    emporioWhatsappGroupUrl: d.emporioWhatsappGroupUrl ?? "",
    pickupEnabled: d.pickupEnabled,
    deliveryEnabled: d.deliveryEnabled,
    deliveryFeeNote: d.deliveryFeeNote ?? "",
    minimumOrderValue:
      d.minimumOrderValue !== null && d.minimumOrderValue !== undefined
        ? String(d.minimumOrderValue)
        : "",
    heroPromoTitle: d.heroPromoTitle ?? "",
    heroPromoText: d.heroPromoText ?? "",
    heroPromoImageUrl: d.heroPromoImageUrl ?? "",
    heroPromoLinkLabel: d.heroPromoLinkLabel ?? "",
    heroPromoLinkHref: d.heroPromoLinkHref ?? "",
    whatsappApiEnabled: d.whatsappApiEnabled,
    whatsappNotifyConfirmed: d.whatsappNotifyConfirmed,
    whatsappNotifyReady: d.whatsappNotifyReady,
    whatsappNotifyOnDelivery: d.whatsappNotifyOnDelivery,
    whatsappNotifyBirthday: d.whatsappNotifyBirthday,
    whatsappNotifyLoyaltyRedeem: d.whatsappNotifyLoyaltyRedeem,
    whatsappNotifyPaymentReceived: d.whatsappNotifyPaymentReceived,
    whatsappNotifyOrderRequestReceived: d.whatsappNotifyOrderRequestReceived,
    whatsappNotifyOrderRequestApproved: d.whatsappNotifyOrderRequestApproved,
    whatsappNotifyOrderRequestRejected: d.whatsappNotifyOrderRequestRejected,
    whatsappNotifyOrderRequestReady: d.whatsappNotifyOrderRequestReady,
    whatsappNotifyNpsRequest: d.whatsappNotifyNpsRequest,
    whatsappNotifyAbandonedCart: d.whatsappNotifyAbandonedCart,
    abandonedCartNotifyAfterMinutes: String(d.abandonedCartNotifyAfterMinutes),
    asaasEnabled: d.asaasEnabled,
    asaasPaymentTtlHours: String(d.asaasPaymentTtlHours),
    kitchenScheduleEnabled: d.kitchenScheduleEnabled,
    kitchenSatOpen: d.kitchenSatOpen,
    kitchenSatClose: d.kitchenSatClose,
    kitchenSunOpen: d.kitchenSunOpen,
    kitchenSunClose: d.kitchenSunClose,
  };
}

export function SettingsForm({ initial }: { initial: Defaults }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [state, setState] = useState(toState(initial));

  function set<K extends keyof typeof state>(key: K, value: typeof state[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function reset() {
    if (!window.confirm("Restaurar valores padrão? Os atuais serão perdidos (mas ficam no histórico).")) return;
    setState(toState(FACTORY_DEFAULTS));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updateSettingsAction(state);
      if (!res.ok) setMsg({ type: "err", text: res.error });
      else {
        setMsg({ type: "ok", text: "Configurações salvas." });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Nome do negócio" required>
            <Input value={state.businessName} onChange={(e) => set("businessName", e.currentTarget.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operação e investimento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label="Custo fixo mensal (R$)"
            hint="Soma dos itens ativos em /custos-fixos. Não editável aqui."
          >
            <div className="flex h-10 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              <span className="font-medium tabular-nums">
                {formatBRL(initial.fixedMonthlyCost)}
              </span>
              <Link
                href="/custos-fixos"
                className="inline-flex items-center gap-1 text-xs text-roxa-700 hover:underline"
              >
                Editar <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </Field>
          <Field label="Investimento já realizado (R$)">
            <Input type="number" step="0.01" min="0" value={state.investedAmount} onChange={(e) => set("investedAmount", e.currentTarget.value)} />
          </Field>
          <Field label="Investimento adicional previsto (R$)">
            <Input type="number" step="0.01" min="0" value={state.plannedInvestment} onChange={(e) => set("plannedInvestment", e.currentTarget.value)} />
          </Field>
          <Field label="Ticket médio alvo (R$)">
            <Input type="number" step="0.01" min="0" value={state.targetAverageTicket} onChange={(e) => set("targetAverageTicket", e.currentTarget.value)} />
          </Field>
          <Field label="Pedidos por fim de semana alvo">
            <Input type="number" min="0" value={state.targetOrdersPerWeekend} onChange={(e) => set("targetOrdersPerWeekend", e.currentTarget.value)} />
          </Field>
          <Field label="Fins de semana por mês">
            <Input type="number" min="1" max="10" value={state.weekendsPerMonth} onChange={(e) => set("weekendsPerMonth", e.currentTarget.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metas de CMV padrão (%)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Frango">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvChicken} onChange={(e) => set("defaultCmvChicken", e.currentTarget.value)} />
          </Field>
          <Field label="Costela">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvBeefRib} onChange={(e) => set("defaultCmvBeefRib", e.currentTarget.value)} />
          </Field>
          <Field label="Suínos">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvPork} onChange={(e) => set("defaultCmvPork", e.currentTarget.value)} />
          </Field>
          <Field label="Acompanhamentos">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvSides} onChange={(e) => set("defaultCmvSides", e.currentTarget.value)} />
          </Field>
          <Field label="Extras">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvExtras} onChange={(e) => set("defaultCmvExtras", e.currentTarget.value)} />
          </Field>
          <Field label="Bebidas">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvBeverages} onChange={(e) => set("defaultCmvBeverages", e.currentTarget.value)} />
          </Field>
          <Field label="Combos">
            <Input type="number" step="0.1" min="0" max="100" value={state.defaultCmvCombos} onChange={(e) => set("defaultCmvCombos", e.currentTarget.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxas de venda (%)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Taxa média de cartão">
            <Input type="number" step="0.1" min="0" max="100" value={state.cardFeePercent} onChange={(e) => set("cardFeePercent", e.currentTarget.value)} />
          </Field>
          <Field label="Taxa média de delivery/app">
            <Input type="number" step="0.1" min="0" max="100" value={state.appFeePercent} onChange={(e) => set("appFeePercent", e.currentTarget.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cardápio online</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Slogan" hint="Aparece no hero da landing pública.">
              <Input
                value={state.siteSlogan}
                onChange={(e) => set("siteSlogan", e.currentTarget.value)}
                placeholder="Sabor de domingo feito em família"
              />
            </Field>
            <Field
              label="WhatsApp"
              hint="Apenas dígitos com DDI/DDD. Ex.: 5511999999999."
            >
              <Input
                value={state.whatsappNumber}
                onChange={(e) => set("whatsappNumber", e.currentTarget.value)}
                placeholder="5511999999999"
              />
            </Field>
          </div>
          <Field label="Endereço">
            <Input
              value={state.address}
              onChange={(e) => set("address", e.currentTarget.value)}
              placeholder="Rua das Flores, 123"
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Bairro / Cidade">
              <Input
                value={state.addressNeighborhood}
                onChange={(e) => set("addressNeighborhood", e.currentTarget.value)}
                placeholder="Centro, São Paulo"
              />
            </Field>
            <Field label="Horário de funcionamento">
              <Input
                value={state.openingHours}
                onChange={(e) => set("openingHours", e.currentTarget.value)}
                placeholder="Sáb e Dom · 11h às 17h"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Instagram (URL)">
              <Input
                value={state.instagramUrl}
                onChange={(e) => set("instagramUrl", e.currentTarget.value)}
                placeholder="https://instagram.com/casaroxa"
              />
            </Field>
            <Field label="Facebook (URL)">
              <Input
                value={state.facebookUrl}
                onChange={(e) => set("facebookUrl", e.currentTarget.value)}
                placeholder="https://facebook.com/casaroxa"
              />
            </Field>
          </div>
          <Field
            label="Grupo de WhatsApp do empório (link de convite)"
            hint="Aparece na página /emporio pra avisar clientes das viagens a Minas."
          >
            <Input
              value={state.emporioWhatsappGroupUrl}
              onChange={(e) => set("emporioWhatsappGroupUrl", e.currentTarget.value)}
              placeholder="https://chat.whatsapp.com/..."
            />
          </Field>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Modalidades de pedido</h4>
            <div className="flex items-center gap-2">
              <Checkbox
                id="pickupEnabled"
                checked={state.pickupEnabled}
                onChange={(e) => set("pickupEnabled", e.currentTarget.checked)}
              />
              <label htmlFor="pickupEnabled" className="text-sm text-slate-700">
                Aceitar retirada no local
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="deliveryEnabled"
                checked={state.deliveryEnabled}
                onChange={(e) => set("deliveryEnabled", e.currentTarget.checked)}
              />
              <label htmlFor="deliveryEnabled" className="text-sm text-slate-700">
                Aceitar delivery
              </label>
            </div>
            <Field
              label="Observação sobre taxa de entrega"
              hint="Texto livre. Aparece no checkout quando o cliente escolhe delivery."
            >
              <Textarea
                rows={2}
                value={state.deliveryFeeNote}
                onChange={(e) => set("deliveryFeeNote", e.currentTarget.value)}
                placeholder="Taxa calculada conforme distância — combinamos pelo WhatsApp."
              />
            </Field>
            <Field label="Pedido mínimo (R$)" hint="Vazio = sem mínimo.">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={state.minimumOrderValue}
                onChange={(e) => set("minimumOrderValue", e.currentTarget.value)}
              />
            </Field>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">
              Promoção em destaque (hero da landing)
            </h4>
            <p className="text-xs text-slate-500">
              Aparece em destaque na primeira dobra da página inicial. Se vazio, mostra o logo grande no lugar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Título da promoção">
                <Input
                  value={state.heroPromoTitle}
                  onChange={(e) => set("heroPromoTitle", e.currentTarget.value)}
                  placeholder="Combo Família neste sábado"
                />
              </Field>
              <Field label="Foto / banner da promoção">
                <ImageUploadField
                  value={state.heroPromoImageUrl}
                  onChange={(url) => set("heroPromoImageUrl", url)}
                  placeholder="/menu/promo.jpg"
                />
              </Field>
            </div>
            <Field label="Texto descritivo">
              <Textarea
                rows={2}
                value={state.heroPromoText}
                onChange={(e) => set("heroPromoText", e.currentTarget.value)}
                placeholder="Frango caipira inteiro + 2 acompanhamentos por R$ 89,00. Só hoje."
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Texto do botão (CTA)"
                hint="Vazio = sem botão na promoção."
              >
                <Input
                  value={state.heroPromoLinkLabel}
                  onChange={(e) => set("heroPromoLinkLabel", e.currentTarget.value)}
                  placeholder="Ver combos"
                />
              </Field>
              <Field
                label="Para onde o botão leva"
                hint="Caminho relativo (/cardapio?cat=COMBOS) ou URL completa."
              >
                <Input
                  value={state.heroPromoLinkHref}
                  onChange={(e) => set("heroPromoLinkHref", e.currentTarget.value)}
                  placeholder="/cardapio?cat=COMBOS"
                />
              </Field>
            </div>
          </div>

          <WhatsAppApiBlock state={state} set={set} />

          <AsaasBlock state={state} set={set} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horário da cozinha (agendamento no checkout)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="kitchenScheduleEnabled"
              checked={state.kitchenScheduleEnabled}
              onChange={(e) => set("kitchenScheduleEnabled", e.currentTarget.checked)}
              className="mt-1"
            />
            <label htmlFor="kitchenScheduleEnabled" className="text-sm text-slate-700">
              Ativar agendamento por horário da cozinha
              <span className="block text-xs text-slate-500">
                Ligado: itens marcados como “depende da cozinha” pedem data e hora
                no checkout (fim de semana). Desligado: volta ao comportamento antigo
                (pedido pra agora e a chave “cozinha fechada”).
              </span>
            </label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Sábado — abre">
              <Input
                type="time"
                value={state.kitchenSatOpen}
                onChange={(e) => set("kitchenSatOpen", e.currentTarget.value)}
                disabled={!state.kitchenScheduleEnabled}
              />
            </Field>
            <Field label="Sábado — fecha">
              <Input
                type="time"
                value={state.kitchenSatClose}
                onChange={(e) => set("kitchenSatClose", e.currentTarget.value)}
                disabled={!state.kitchenScheduleEnabled}
              />
            </Field>
            <Field label="Domingo — abre">
              <Input
                type="time"
                value={state.kitchenSunOpen}
                onChange={(e) => set("kitchenSunOpen", e.currentTarget.value)}
                disabled={!state.kitchenScheduleEnabled}
              />
            </Field>
            <Field label="Domingo — fecha">
              <Input
                type="time"
                value={state.kitchenSunClose}
                onChange={(e) => set("kitchenSunClose", e.currentTarget.value)}
                disabled={!state.kitchenScheduleEnabled}
              />
            </Field>
          </div>
          <p className="text-xs text-slate-500">
            Deixe abre/fecha vazios pra fechar o dia. Os demais dias da semana ficam
            fechados. Horário local (America/Sao_Paulo).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perdas médias por carne (%)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Costela bovina">
            <Input type="number" step="0.1" min="0" max="100" value={state.beefRibLossPercent} onChange={(e) => set("beefRibLossPercent", e.currentTarget.value)} />
          </Field>
          <Field label="Costelinha suína">
            <Input type="number" step="0.1" min="0" max="100" value={state.porkRibLossPercent} onChange={(e) => set("porkRibLossPercent", e.currentTarget.value)} />
          </Field>
          <Field label="Panceta">
            <Input type="number" step="0.1" min="0" max="100" value={state.pancetaLossPercent} onChange={(e) => set("pancetaLossPercent", e.currentTarget.value)} />
          </Field>
          <Field label="Lombo / pernil">
            <Input type="number" step="0.1" min="0" max="100" value={state.porkLoinLossPercent} onChange={(e) => set("porkLoinLossPercent", e.currentTarget.value)} />
          </Field>
        </CardContent>
      </Card>

      {msg && (
        <div
          className={
            msg.type === "ok"
              ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {msg.text}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={reset} disabled={isPending}>
          Restaurar padrão
        </Button>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================
// Bloco WhatsApp API (toggles + status check)
// ============================================================

type StateShape = ReturnType<typeof toState>;

function WhatsAppApiBlock({
  state,
  set,
}: {
  state: StateShape;
  set: <K extends keyof StateShape>(key: K, value: StateShape[K]) => void;
}) {
  const [statusBusy, setStatusBusy] = useState(false);
  const [status, setStatus] = useState<{
    ok: boolean;
    msg: string;
    connected?: boolean;
  } | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [disconnectBusy, setDisconnectBusy] = useState(false);

  /**
   * Detecta "conectado" em qualquer formato razoável que a wuzapi possa
   * retornar. Olha campos booleanos comuns, strings de status, e desce
   * recursivamente em data/result/session pra cobrir respostas aninhadas.
   */
  function detectConnected(d: unknown): boolean {
    if (!d || typeof d !== "object") return false;
    const obj = d as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      const norm = key.toLowerCase();
      if (
        value === true &&
        ["connected", "loggedin", "isconnected", "islogged", "paired"].includes(
          norm,
        )
      ) {
        return true;
      }
      if (
        typeof value === "string" &&
        /connected|paired|logged|online|ready|active/i.test(value)
      ) {
        return true;
      }
      if (
        ["data", "result", "session", "payload", "info"].includes(norm) &&
        value &&
        typeof value === "object"
      ) {
        if (detectConnected(value)) return true;
      }
    }
    return false;
  }

  async function check() {
    setStatusBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/whatsapp/status");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus({ ok: false, msg: data.error ?? "Falha ao consultar status." });
      } else {
        const connected = detectConnected(data.data);
        setStatus({
          ok: true,
          connected,
          msg: connected
            ? "Número conectado ✓"
            : "Servidor responde, mas o número não está pareado.",
        });
      }
    } catch (e) {
      setStatus({
        ok: false,
        msg: e instanceof Error ? e.message : "Erro de rede",
      });
    } finally {
      setStatusBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Desconectar o WhatsApp? Vai precisar parear de novo via QR.")) return;
    setDisconnectBusy(true);
    try {
      const res = await fetch("/api/admin/whatsapp/disconnect", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        window.alert(data.error ?? "Falha ao desconectar.");
        return;
      }
      setStatus({ ok: true, connected: false, msg: "Desconectado." });
    } finally {
      setDisconnectBusy(false);
    }
  }

  const statusToneClass =
    status?.ok && status.connected
      ? "bg-green-50 text-green-800 ring-green-200"
      : status?.ok
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : status
          ? "bg-red-50 text-red-700 ring-red-200"
          : "bg-slate-100 text-slate-600 ring-slate-200";

  const statusBadge =
    status?.ok && status.connected
      ? "Conectado"
      : status?.ok
        ? "Não pareado"
        : status
          ? "Erro"
          : "Status desconhecido";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
      {/* Header com título + status badge */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-green-100 text-green-700">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              WhatsApp da Casa Roxa
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Notificações automáticas pro cliente em eventos do pedido,
              aniversário e fidelidade.
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusToneClass}`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              status?.ok && status.connected
                ? "bg-green-500"
                : status?.ok
                  ? "bg-amber-500"
                  : status
                    ? "bg-red-500"
                    : "bg-slate-400"
            }`}
          />
          {statusBadge}
        </span>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={check}
          disabled={statusBusy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${statusBusy ? "animate-spin" : ""}`} />
          {statusBusy ? "Verificando…" : "Testar conexão"}
        </button>
        {status?.ok && status.connected ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={disconnectBusy}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <PowerOff className="h-3.5 w-3.5" />
            {disconnectBusy ? "Desconectando…" : "Desconectar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-green-600 px-3 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <QrCode className="h-3.5 w-3.5" />
            Conectar WhatsApp
          </button>
        )}
        <a
          href="/configuracoes/whatsapp/logs"
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-slate-500 hover:bg-white hover:text-slate-700"
        >
          <FileText className="h-3.5 w-3.5" />
          Ver logs
        </a>
      </div>

      {status && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            status.ok && status.connected
              ? "border-green-200 bg-green-50 text-green-800"
              : status.ok
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {status.msg}
        </div>
      )}

      {/* Eventos automáticos */}
      <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Eventos automáticos
          </p>
          <span className="text-[11px] text-slate-400">
            {state.whatsappApiEnabled ? "ativo" : "desligado"}
          </span>
        </div>

        <ToggleRow
          id="whatsappApiEnabled"
          checked={state.whatsappApiEnabled}
          onChange={(v) => set("whatsappApiEnabled", v)}
          label="Envios automáticos via API"
          hint="Master switch — se desligado, todos os eventos abaixo ficam pausados."
          accent
        />

        <div className="space-y-1.5 pl-1">
          <ToggleRow
            id="wnConfirmed"
            checked={state.whatsappNotifyConfirmed}
            onChange={(v) => set("whatsappNotifyConfirmed", v)}
            disabled={!state.whatsappApiEnabled}
            label="Pedido confirmado"
            hint="Quando você marca o pedido como Confirmado."
          />
          <ToggleRow
            id="wnReady"
            checked={state.whatsappNotifyReady}
            onChange={(v) => set("whatsappNotifyReady", v)}
            disabled={!state.whatsappApiEnabled}
            label="Pedido pronto"
            hint="Quando o pedido vira Pronto pra retirada/entrega."
          />
          <ToggleRow
            id="wnOnDelivery"
            checked={state.whatsappNotifyOnDelivery}
            onChange={(v) => set("whatsappNotifyOnDelivery", v)}
            disabled={!state.whatsappApiEnabled}
            label="Saiu pra entrega"
            hint="Avisa o cliente que o motoboy saiu."
          />
          <ToggleRow
            id="wnBirthday"
            checked={state.whatsappNotifyBirthday}
            onChange={(v) => set("whatsappNotifyBirthday", v)}
            disabled={!state.whatsappApiEnabled}
            label="Cupom de aniversário"
            hint="Botão Enviar no dashboard manda direto via API."
          />
          <ToggleRow
            id="wnLoyalty"
            checked={state.whatsappNotifyLoyaltyRedeem}
            onChange={(v) => set("whatsappNotifyLoyaltyRedeem", v)}
            disabled={!state.whatsappApiEnabled}
            label="Resgate fidelidade"
            hint="Cliente bateu 100 pts e ganhou cupom — avisa automático."
          />
          <ToggleRow
            id="wnPayment"
            checked={state.whatsappNotifyPaymentReceived}
            onChange={(v) => set("whatsappNotifyPaymentReceived", v)}
            disabled={!state.whatsappApiEnabled}
            label="Pagamento recebido"
            hint="Avisa quando o cliente paga (PIX/cartão via Asaas)."
          />
          <ToggleRow
            id="wnOrReceived"
            checked={state.whatsappNotifyOrderRequestReceived}
            onChange={(v) => set("whatsappNotifyOrderRequestReceived", v)}
            disabled={!state.whatsappApiEnabled}
            label="Encomenda recebida"
            hint="Confirmação automática quando o cliente envia a encomenda pelo site."
          />
          <ToggleRow
            id="wnOrApproved"
            checked={state.whatsappNotifyOrderRequestApproved}
            onChange={(v) => set("whatsappNotifyOrderRequestApproved", v)}
            disabled={!state.whatsappApiEnabled}
            label="Encomenda aprovada"
            hint="Avisa o cliente quando você aprova a encomenda no painel."
          />
          <ToggleRow
            id="wnOrRejected"
            checked={state.whatsappNotifyOrderRequestRejected}
            onChange={(v) => set("whatsappNotifyOrderRequestRejected", v)}
            disabled={!state.whatsappApiEnabled}
            label="Encomenda recusada"
            hint="Manda o motivo da recusa pro cliente."
          />
          <ToggleRow
            id="wnOrReady"
            checked={state.whatsappNotifyOrderRequestReady}
            onChange={(v) => set("whatsappNotifyOrderRequestReady", v)}
            disabled={!state.whatsappApiEnabled}
            label="Encomenda pronta"
            hint="Avisa quando a encomenda fica PRONTA pra retirada/entrega."
          />
          <ToggleRow
            id="wnNps"
            checked={state.whatsappNotifyNpsRequest}
            onChange={(v) => set("whatsappNotifyNpsRequest", v)}
            disabled={!state.whatsappApiEnabled}
            label="Pedido de avaliação (NPS)"
            hint="Quando você clica 'Enviar avaliação' em uma venda, manda o link pelo WhatsApp."
          />
          <ToggleRow
            id="wnAbandonedCart"
            checked={state.whatsappNotifyAbandonedCart}
            onChange={(v) => set("whatsappNotifyAbandonedCart", v)}
            disabled={!state.whatsappApiEnabled}
            label="Carrinho abandonado"
            hint={`Cron envia WhatsApp pra quem digitou telefone mas não finalizou. Espera ${state.abandonedCartNotifyAfterMinutes || "30"} min depois do abandono.`}
          />
        </div>
      </div>

      <ConnectWhatsAppDialog
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={() => {
          setConnectOpen(false);
          check();
        }}
      />
    </div>
  );
}

// ============================================================
// Bloco Asaas (pagamento online)
// ============================================================

function AsaasBlock({
  state,
  set,
}: {
  state: StateShape;
  set: <K extends keyof StateShape>(key: K, value: StateShape[K]) => void;
}) {
  const [pingBusy, setPingBusy] = useState(false);
  const [pingResult, setPingResult] = useState<{
    ok: boolean;
    env?: string;
    msg: string;
  } | null>(null);

  async function testConnection() {
    setPingBusy(true);
    setPingResult(null);
    try {
      const res = await fetch("/api/admin/asaas/ping");
      const data = await res.json();
      if (!data.ok) {
        setPingResult({
          ok: false,
          msg: data.error ?? "Falha ao conectar com Asaas.",
        });
      } else {
        setPingResult({
          ok: true,
          env: data.env,
          msg: `Conectado em ${data.env === "production" ? "PRODUÇÃO" : "sandbox"}.`,
        });
      }
    } catch (e) {
      setPingResult({
        ok: false,
        msg: e instanceof Error ? e.message : "Erro de rede",
      });
    } finally {
      setPingBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-blue-100 text-blue-700">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              Pagamento online (Asaas)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              PIX e cartão de crédito no checkout do cardápio. API key vai
              em env (ASAAS_API_KEY) e ASAAS_ENV={"{"}sandbox|production{"}"}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={testConnection}
          disabled={pingBusy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pingBusy ? "animate-spin" : ""}`} />
          {pingBusy ? "Verificando…" : "Testar conexão"}
        </button>
      </div>

      {pingResult && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            pingResult.ok
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {pingResult.msg}
        </div>
      )}

      <div className="rounded-md border border-slate-200 bg-white p-3 space-y-3">
        <ToggleRow
          id="asaasEnabled"
          checked={state.asaasEnabled}
          onChange={(v) => set("asaasEnabled", v)}
          label="Aceitar pagamento online no checkout"
          hint="Quando ligado, cliente vê as opções PIX/Cartão no checkout. Mesmo desligado, payments já criados continuam acessíveis."
          accent
        />

        <Field
          label="Tempo limite pro cliente pagar (horas)"
          hint="Após esse tempo, o link de pagamento expira. Padrão 24h."
        >
          <Input
            type="number"
            min="1"
            max="168"
            value={state.asaasPaymentTtlHours}
            onChange={(e) =>
              set("asaasPaymentTtlHours", e.currentTarget.value as never)
            }
            disabled={!state.asaasEnabled}
            className="w-32"
          />
        </Field>
      </div>

      <WebhookUrlBlock />
    </div>
  );
}

function WebhookUrlBlock() {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState<string>("https://casaroxa.com.br");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Detecta domínio público: se estamos em gestao.X, troca pra X.
    const host = window.location.host;
    const publicHost = host.startsWith("gestao.")
      ? host.slice("gestao.".length)
      : host.startsWith("staging-gestao.")
        ? `staging.${host.slice("staging-gestao.".length)}`
        : host;
    setOrigin(`${window.location.protocol}//${publicHost}`);
  }, []);

  const url = `${origin}/api/public/webhook/asaas`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* */
    }
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900">
        ⚠️ URL do webhook (usar EXATAMENTE essa, sem subdomínio admin)
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono text-[12px] bg-white border border-amber-200 px-2 py-1 rounded overflow-x-auto whitespace-nowrap">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 whitespace-nowrap"
        >
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
      <p className="text-[11px] text-amber-800">
        Configure no painel Asaas → <em>Integrações → Webhooks</em>.
        Cuidado: <strong>NÃO</strong> use o domínio <code>gestao.*</code> — o
        admin redireciona POST e o Asaas pausa o webhook após 15 falhas.
      </p>
    </div>
  );
}

function ToggleRow({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled,
  accent,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-2.5 rounded-md p-1.5 -mx-1.5 ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:bg-slate-50"
      }`}
    >
      <Checkbox
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        disabled={disabled}
        className="mt-0.5"
      />
      <span className="flex-1">
        <span
          className={`block text-sm ${
            accent ? "font-semibold text-slate-900" : "font-medium text-slate-700"
          }`}
        >
          {label}
        </span>
        {hint && (
          <span className="block text-[11px] text-slate-500 mt-0.5">{hint}</span>
        )}
      </span>
    </label>
  );
}
