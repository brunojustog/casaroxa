import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { CartProvider } from "@/components/public/cart/CartProvider";
import { CartFloatingCta } from "@/components/public/cart/CartFloatingCta";
import { RestaurantJsonLd } from "@/components/public/seo/RestaurantJsonLd";
import { getSiteSettings } from "@/server/services/public-menu.service";
import { getAuthedCustomer } from "@/server/services/customer-session.service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = settings.businessName;
  const description =
    settings.siteSlogan ??
    "Frangos assados, costelas e suínos. Faça seu pedido pelo cardápio online.";

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "pt_BR",
      siteName: settings.businessName,
    },
    twitter: {
      title,
      description,
    },
  };
}

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, customer] = await Promise.all([
    getSiteSettings(),
    getAuthedCustomer(),
  ]);
  return (
    <CartProvider>
      <div className="min-h-screen bg-roxa-50/30 font-sans text-slate-900">
        <PublicHeader
          settings={settings}
          customer={
            customer ? { name: customer.name, phone: customer.phone } : null
          }
        />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">{children}</main>
        <PublicFooter settings={settings} />
        <CartFloatingCta />
        <RestaurantJsonLd settings={settings} />
      </div>
    </CartProvider>
  );
}
