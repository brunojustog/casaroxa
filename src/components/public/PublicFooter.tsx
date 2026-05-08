import Link from "next/link";
import { Clock, Instagram, Facebook, MapPin, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";
import type { PublicSiteSettings } from "@/server/services/public-menu.service";

export function PublicFooter({ settings }: { settings: PublicSiteSettings }) {
  const wa = whatsappLink(settings.whatsappNumber);
  const fullAddress = [settings.address, settings.addressNeighborhood]
    .filter(Boolean)
    .join(" — ");

  return (
    <footer className="mt-16 border-t border-roxa-100 bg-roxa-900 text-roxa-50">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-serif text-lg font-semibold">{settings.businessName}</h3>
            {settings.siteSlogan && (
              <p className="mt-1 text-sm italic text-roxa-200">{settings.siteSlogan}</p>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-roxa-200">
              Contato
            </h4>
            {fullAddress && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-roxa-200" />
                <span>{fullAddress}</span>
              </p>
            )}
            {settings.openingHours && (
              <p className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-roxa-200" />
                <span>{settings.openingHours}</span>
              </p>
            )}
            {wa && (
              <p>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  <MessageCircle className="h-4 w-4 text-roxa-200" />
                  <span>Falar pelo WhatsApp</span>
                </a>
              </p>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-roxa-200">
              Acompanhe
            </h4>
            {settings.instagramUrl && (
              <p>
                <a
                  href={settings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  <Instagram className="h-4 w-4 text-roxa-200" />
                  Instagram
                </a>
              </p>
            )}
            {settings.facebookUrl && (
              <p>
                <a
                  href={settings.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  <Facebook className="h-4 w-4 text-roxa-200" />
                  Facebook
                </a>
              </p>
            )}
            <div className="pt-2 text-xs text-roxa-300">
              <Link href="/login" className="hover:text-white">
                Acesso interno
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-roxa-800 pt-4 text-xs text-roxa-300">
          © {new Date().getFullYear()} {settings.businessName}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
