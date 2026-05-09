import type { PublicSiteSettings } from "@/server/services/public-menu.service";

/**
 * Schema.org JSON-LD para Restaurant.
 * Ajuda Google/Bing a entender os dados (horário, endereço, telefone) e
 * potencialmente exibir rich results em buscas. Renderizado em script
 * inline no fim do layout público.
 */
export function RestaurantJsonLd({ settings }: { settings: PublicSiteSettings }) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: settings.businessName,
    image: "/logo.png",
    servesCuisine: "Brasileira",
    priceRange: "$$",
  };

  if (settings.siteSlogan) {
    data.slogan = settings.siteSlogan;
    data.description = settings.siteSlogan;
  }

  if (settings.address || settings.addressNeighborhood) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: settings.address ?? undefined,
      addressLocality: settings.addressNeighborhood ?? undefined,
      addressCountry: "BR",
    };
  }

  if (settings.whatsappNumber) {
    // Formata para padrão E.164 (com +)
    const digits = settings.whatsappNumber.replace(/\D/g, "");
    data.telephone = digits ? `+${digits}` : undefined;
  }

  if (settings.openingHours) {
    // Texto livre — Google entende razoavelmente bem.
    data.openingHours = settings.openingHours;
  }

  const sameAs: string[] = [];
  if (settings.instagramUrl) sameAs.push(settings.instagramUrl);
  if (settings.facebookUrl) sameAs.push(settings.facebookUrl);
  if (sameAs.length > 0) data.sameAs = sameAs;

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
