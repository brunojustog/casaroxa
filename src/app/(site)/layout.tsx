import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { CartProvider } from "@/components/public/cart/CartProvider";
import { CartFloatingCta } from "@/components/public/cart/CartFloatingCta";
import { getSiteSettings } from "@/server/services/public-menu.service";

export const dynamic = "force-dynamic";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  return (
    <CartProvider>
      <div className="min-h-screen bg-roxa-50/30 font-sans text-slate-900">
        <PublicHeader settings={settings} />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">{children}</main>
        <PublicFooter settings={settings} />
        <CartFloatingCta />
      </div>
    </CartProvider>
  );
}
