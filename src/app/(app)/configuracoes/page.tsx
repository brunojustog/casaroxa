import { History } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/SettingsForm";
import {
  getSettings,
  getSettingsHistory,
} from "@/server/services/settings.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const [settings, history] = await Promise.all([
    getSettings(),
    getSettingsHistory(20),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configurações / Premissas"
        description="Parâmetros globais usados pelo simulador, cenários e dashboard. Cada alteração fica registrada no histórico."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <SettingsForm
            initial={{
              businessName: settings.businessName,
              fixedMonthlyCost: Number(settings.fixedMonthlyCost),
              investedAmount: Number(settings.investedAmount),
              plannedInvestment: Number(settings.plannedInvestment),
              targetAverageTicket: Number(settings.targetAverageTicket),
              targetOrdersPerWeekend: settings.targetOrdersPerWeekend,
              weekendsPerMonth: settings.weekendsPerMonth,
              defaultCmvChicken: Number(settings.defaultCmvChicken),
              defaultCmvBeefRib: Number(settings.defaultCmvBeefRib),
              defaultCmvPork: Number(settings.defaultCmvPork),
              defaultCmvSides: Number(settings.defaultCmvSides),
              defaultCmvExtras: Number(settings.defaultCmvExtras),
              defaultCmvBeverages: Number(settings.defaultCmvBeverages),
              defaultCmvCombos: Number(settings.defaultCmvCombos),
              cardFeePercent: Number(settings.cardFeePercent),
              appFeePercent: Number(settings.appFeePercent),
              beefRibLossPercent: Number(settings.beefRibLossPercent),
              porkRibLossPercent: Number(settings.porkRibLossPercent),
              pancetaLossPercent: Number(settings.pancetaLossPercent),
              porkLoinLossPercent: Number(settings.porkLoinLossPercent),
              siteSlogan: settings.siteSlogan,
              whatsappNumber: settings.whatsappNumber,
              address: settings.address,
              addressNeighborhood: settings.addressNeighborhood,
              openingHours: settings.openingHours,
              instagramUrl: settings.instagramUrl,
              facebookUrl: settings.facebookUrl,
              pickupEnabled: settings.pickupEnabled,
              deliveryEnabled: settings.deliveryEnabled,
              deliveryFeeNote: settings.deliveryFeeNote,
              minimumOrderValue: settings.minimumOrderValue
                ? Number(settings.minimumOrderValue)
                : null,
              heroPromoTitle: settings.heroPromoTitle,
              heroPromoText: settings.heroPromoText,
              heroPromoImageUrl: settings.heroPromoImageUrl,
              heroPromoLinkLabel: settings.heroPromoLinkLabel,
              heroPromoLinkHref: settings.heroPromoLinkHref,
              whatsappApiEnabled: settings.whatsappApiEnabled,
              whatsappNotifyConfirmed: settings.whatsappNotifyConfirmed,
              whatsappNotifyReady: settings.whatsappNotifyReady,
              whatsappNotifyOnDelivery: settings.whatsappNotifyOnDelivery,
              whatsappNotifyBirthday: settings.whatsappNotifyBirthday,
              whatsappNotifyLoyaltyRedeem: settings.whatsappNotifyLoyaltyRedeem,
              whatsappNotifyPaymentReceived: settings.whatsappNotifyPaymentReceived,
              whatsappNotifyOrderRequestReceived: settings.whatsappNotifyOrderRequestReceived,
              whatsappNotifyOrderRequestApproved: settings.whatsappNotifyOrderRequestApproved,
              whatsappNotifyOrderRequestRejected: settings.whatsappNotifyOrderRequestRejected,
              whatsappNotifyOrderRequestReady: settings.whatsappNotifyOrderRequestReady,
              whatsappNotifyNpsRequest: settings.whatsappNotifyNpsRequest,
              asaasEnabled: settings.asaasEnabled,
              asaasPaymentTtlHours: settings.asaasPaymentTtlHours,
            }}
          />
        </div>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-slate-500" />
                Histórico de alterações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Sem alterações registradas ainda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-slate-500">
                          {formatDateTime(h.changedAt)}
                        </span>
                        {h.changedBy?.name && (
                          <span className="text-slate-400">{h.changedBy.name}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
