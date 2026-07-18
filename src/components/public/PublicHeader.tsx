import Link from "next/link";
import Image from "next/image";
import { History, MessageCircle, Package, Store } from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";
import { CartIndicator } from "./cart/CartIndicator";
import { CustomerMenu } from "./CustomerMenu";
import type { PublicSiteSettings } from "@/server/services/public-menu.service";

export function PublicHeader({
  settings,
  customer,
}: {
  settings: PublicSiteSettings;
  customer: { name: string; phone: string } | null;
}) {
  const wa = whatsappLink(settings.whatsappNumber, "Olá, vim pelo site!");

  return (
    <header className="sticky top-0 z-30 border-b border-roxa-100 bg-roxa-50/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt={settings.businessName}
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
            priority
          />
          <span className="hidden font-serif text-lg font-bold text-roxa-800 sm:inline">
            {settings.businessName}
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-roxa-800 hover:bg-roxa-100"
          >
            Início
          </Link>
          <Link
            href="/cardapio"
            className="rounded-md px-3 py-2 text-roxa-800 hover:bg-roxa-100"
          >
            Cardápio
          </Link>
          <Link
            href="/emporio"
            className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-roxa-800 hover:bg-roxa-100"
            title="Queijos, doces e quitutes mineiros"
          >
            <Store className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Empório</span>
          </Link>
          <Link
            href="/encomenda"
            className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-roxa-800 hover:bg-roxa-100"
            title="Fazer encomenda com antecedência"
          >
            <Package className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Encomendar</span>
          </Link>
          <Link
            href="/meus-pedidos"
            className="hidden md:inline-flex items-center gap-1 rounded-md px-3 py-2 text-roxa-800 hover:bg-roxa-100"
            title="Histórico de pedidos e cupons"
          >
            <History className="h-3.5 w-3.5" />
            Meus pedidos
          </Link>
          <CartIndicator />
          {customer && <CustomerMenu customer={customer} />}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
