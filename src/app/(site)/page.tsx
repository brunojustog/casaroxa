import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, MapPin, MessageCircle, Snowflake, Store, UtensilsCrossed } from "lucide-react";
import {
  getEmporioMenu,
  getPublicMenu,
  getSiteSettings,
  listGoogleReviews,
} from "@/server/services/public-menu.service";
import { whatsappLink } from "@/lib/whatsapp";
import { GoogleReviewsCarousel } from "@/components/public/GoogleReviewsCarousel";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const ogImage = settings.heroPromoImageUrl ?? "/logo.png";
  return {
    title: { absolute: settings.businessName },
    description:
      settings.siteSlogan ??
      "Frangos assados, costelas e suínos. Sabor de domingo feito em família.",
    openGraph: {
      title: settings.businessName,
      description: settings.siteSlogan ?? "Sabor de domingo feito em família.",
      images: [{ url: ogImage, alt: settings.businessName }],
    },
    twitter: { images: [ogImage] },
  };
}

export default async function HomePage() {
  const [menu, settings, emporio, googleReviews] = await Promise.all([
    getPublicMenu(),
    getSiteSettings(),
    getEmporioMenu(),
    listGoogleReviews(),
  ]);

  const wa = whatsappLink(
    settings.whatsappNumber,
    "Olá! Vim pelo site e quero fazer um pedido.",
  );

  // Pega até 3 categorias com itens pra preview na landing (congelados têm
  // seção própria mais abaixo)
  const categoryPreview = menu
    .filter((c) => c.category !== "CONGELADOS")
    .slice(0, 3);
  const totalItems = menu.reduce((acc, c) => acc + c.items.length, 0);
  const congelados = menu.find((c) => c.category === "CONGELADOS")?.items ?? [];

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-roxa-100 bg-gradient-to-br from-roxa-50 via-white to-roxa-100/50 px-6 py-12 md:px-12 md:py-20">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-roxa-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-roxa-800">
              <UtensilsCrossed className="h-3 w-3" />
              {settings.openingHours ?? "Aberto fins de semana"}
            </div>
            <h1 className="font-serif text-4xl font-bold leading-tight text-roxa-900 md:text-5xl">
              {settings.businessName}
            </h1>
            {settings.siteSlogan && (
              <p className="text-xl italic text-roxa-700 md:text-2xl">
                &ldquo;{settings.siteSlogan}&rdquo;
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/cardapio"
                className="inline-flex items-center gap-2 rounded-md bg-roxa-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-roxa-800"
              >
                Ver cardápio
                <ArrowRight className="h-4 w-4" />
              </Link>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-umami-event="clique-whatsapp"
                  data-umami-event-origem="home-hero"
                  className="inline-flex items-center gap-2 rounded-md border border-green-600 bg-white px-5 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  Pedir pelo WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <HeroSidePanel settings={settings} />
          </div>
        </div>
      </section>

      {/* Prova social — avaliações do Google (some se não houver curadas) */}
      <GoogleReviewsCarousel reviews={googleReviews} />

      {/* Quick info */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard
          icon={<MapPin className="h-5 w-5 text-roxa-700" />}
          title="Onde encontrar"
          lines={[settings.address, settings.addressNeighborhood].filter(Boolean) as string[]}
          fallback="Endereço em breve"
        />
        <InfoCard
          icon={<Clock className="h-5 w-5 text-roxa-700" />}
          title="Horário"
          lines={settings.openingHours ? [settings.openingHours] : []}
          fallback="Aos finais de semana"
        />
        <InfoCard
          icon={<UtensilsCrossed className="h-5 w-5 text-roxa-700" />}
          title="Como pedir"
          lines={[
            settings.pickupEnabled ? "Retirada no local" : null,
            settings.deliveryEnabled ? "Delivery na região" : null,
          ].filter(Boolean) as string[]}
          fallback="Pelo WhatsApp ou no balcão"
        />
      </section>

      {/* Cardápio em destaque */}
      {totalItems > 0 ? (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl font-bold text-roxa-900">
                Nosso cardápio
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {totalItems} item{totalItems === 1 ? "" : "s"} disponível
                {totalItems === 1 ? "" : "s"}.
              </p>
            </div>
            <Link
              href="/cardapio"
              className="hidden text-sm font-medium text-roxa-700 hover:underline sm:inline"
            >
              Ver tudo →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categoryPreview.map((cat) => (
              <Link
                key={cat.category}
                href={`/cardapio?cat=${encodeURIComponent(String(cat.category))}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-roxa-100 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-roxa-100">
                  {cat.coverImageUrl ? (
                    <Image
                      src={cat.coverImageUrl}
                      alt={cat.label}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition group-hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-roxa-300">
                      <UtensilsCrossed className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-roxa-900/85 via-roxa-900/40 to-transparent p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-roxa-200">
                      Categoria
                    </span>
                    <h3 className="mt-0.5 font-serif text-2xl font-semibold text-white">
                      {cat.label}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 p-4">
                  <p className="text-sm text-slate-600">
                    {cat.items.length} item{cat.items.length === 1 ? "" : "s"}
                  </p>
                  <span className="text-sm font-medium text-roxa-700 group-hover:underline">
                    Explorar →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/cardapio"
              className="inline-flex items-center gap-2 rounded-md bg-roxa-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-roxa-800"
            >
              Ver cardápio completo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-roxa-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-600">
            Cardápio em preparação. Volte em breve ou fale com a gente
            {wa && (
              <>
                {" "}
                <a
                  href={wa}
                  className="font-medium text-green-700 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  pelo WhatsApp
                </a>
              </>
            )}
            .
          </p>
        </section>
      )}

      {/* Congelados da Casa */}
      {congelados.length > 0 && (
        <section className="relative overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-roxa-50 px-6 py-10 md:px-12">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="order-last grid grid-cols-2 gap-3 md:order-first">
              {congelados
                .filter((i) => i.imageUrl)
                .slice(0, 4)
                .map((i) => (
                  <Link
                    key={i.id}
                    href={`/cardapio/produto/${i.id}`}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm"
                  >
                    <Image
                      src={i.imageUrl!}
                      alt={i.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover transition group-hover:scale-105"
                      unoptimized
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-roxa-900/80 to-transparent p-2.5 text-xs font-semibold text-white">
                      {i.name}
                    </span>
                  </Link>
                ))}
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-800">
                <Snowflake className="h-3.5 w-3.5" />
                Novidade
              </div>
              <h2 className="font-serif text-3xl font-bold text-roxa-900 md:text-4xl">
                Congelados da Casa
              </h2>
              <p className="text-base text-slate-700">
                Salgados, quibes e tortas feitos aqui na Casa Roxa e congelados
                na hora. É só fritar ou assar e servir. Vendidos por peso:
                você leva quanto quiser pra resolver a semana.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/cardapio?cat=CONGELADOS"
                  className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800"
                >
                  Ver congelados
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/encomenda"
                  className="inline-flex items-center gap-2 rounded-md border border-sky-300 bg-white px-5 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-50"
                >
                  Fazer encomenda
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Empório */}
      {emporio.length > 0 && (
        <section className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-roxa-50 px-6 py-10 md:px-12">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-800">
                <Store className="h-3.5 w-3.5" />
                Novidade
              </div>
              <h2 className="font-serif text-3xl font-bold text-roxa-900 md:text-4xl">
                Empório Casa Roxa
              </h2>
              <p className="text-base text-slate-700">
                Queijos artesanais, doces caseiros, bolachinhas e quitutes de
                Minas pra levar junto com o seu assado — ou presentear quem
                você gosta. {emporio.length} produto
                {emporio.length === 1 ? "" : "s"} esperando você.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/emporio"
                  className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
                >
                  Conhecer o empório
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/emporio/encomenda"
                  className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-5 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-50"
                >
                  Fazer encomenda
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {emporio
                .filter((i) => i.imageUrl)
                .slice(0, 4)
                .map((i) => (
                  <Link
                    key={i.id}
                    href={`/cardapio/produto/${i.id}`}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm"
                  >
                    <Image
                      src={i.imageUrl!}
                      alt={i.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover transition group-hover:scale-105"
                      unoptimized
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-roxa-900/80 to-transparent p-2.5 text-xs font-semibold text-white">
                      {i.name}
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function HeroSidePanel({
  settings,
}: {
  settings: {
    businessName: string;
    heroPromoTitle: string | null;
    heroPromoText: string | null;
    heroPromoImageUrl: string | null;
    heroPromoLinkLabel: string | null;
    heroPromoLinkHref: string | null;
  };
}) {
  const hasPromo =
    !!settings.heroPromoTitle ||
    !!settings.heroPromoText ||
    !!settings.heroPromoImageUrl;

  if (!hasPromo) {
    // Fallback: logo grande (decorativo — não ocupa espaço no celular)
    return (
      <div className="relative hidden h-72 w-72 md:block">
        <Image
          src="/logo.png"
          alt={settings.businessName}
          fill
          className="object-contain"
          priority
        />
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-roxa-200 bg-white shadow-lg">
      {settings.heroPromoImageUrl && (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-roxa-100">
          <Image
            src={settings.heroPromoImageUrl}
            alt={settings.heroPromoTitle ?? "Promoção"}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
            unoptimized
          />
          <span className="absolute left-3 top-3 rounded-full bg-roxa-700 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white shadow">
            Promoção
          </span>
        </div>
      )}
      <div className="space-y-2 p-5">
        {!settings.heroPromoImageUrl && (
          <span className="inline-block rounded-full bg-roxa-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-roxa-800">
            Promoção
          </span>
        )}
        {settings.heroPromoTitle && (
          <h3 className="font-serif text-2xl font-bold text-roxa-900">
            {settings.heroPromoTitle}
          </h3>
        )}
        {settings.heroPromoText && (
          <p className="text-sm text-slate-700">{settings.heroPromoText}</p>
        )}
        {settings.heroPromoLinkLabel && settings.heroPromoLinkHref && (
          <Link
            href={settings.heroPromoLinkHref}
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-roxa-700 px-4 py-2 text-sm font-semibold text-white hover:bg-roxa-800"
          >
            {settings.heroPromoLinkLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  lines,
  fallback,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
  fallback: string;
}) {
  return (
    <div className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold uppercase tracking-wider text-roxa-700">
          {title}
        </h3>
      </div>
      <div className="mt-2 space-y-0.5 text-sm text-slate-700">
        {lines.length === 0 ? (
          <p className="text-slate-400">{fallback}</p>
        ) : (
          lines.map((l, i) => <p key={i}>{l}</p>)
        )}
      </div>
    </div>
  );
}
