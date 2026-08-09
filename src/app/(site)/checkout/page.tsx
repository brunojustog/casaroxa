import { CheckoutClient } from "@/components/public/checkout/CheckoutClient";
import {
  getKitchenScheduleForCheckout,
  getSiteSettings,
} from "@/server/services/public-menu.service";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [settings, kitchenSchedule] = await Promise.all([
    getSiteSettings(),
    getKitchenScheduleForCheckout(),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-bold text-roxa-900">
          Finalizar pedido
        </h1>
        <p className="text-sm text-slate-600">
          Confira seu pedido, preencha seus dados e envie. Confirmamos pelo WhatsApp.
        </p>
      </header>

      <CheckoutClient
        settings={{
          pickupEnabled: settings.pickupEnabled,
          deliveryEnabled: settings.deliveryEnabled,
          asaasEnabled: settings.asaasEnabled,
          deliveryFeeNote: settings.deliveryFeeNote,
          deliveryFee: settings.deliveryFee,
          minimumOrderValue: settings.minimumOrderValue,
          whatsappNumber: settings.whatsappNumber,
        }}
        kitchenSchedule={kitchenSchedule}
      />
    </div>
  );
}
