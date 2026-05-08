import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, MapPin, MessageCircle, UtensilsCrossed } from "lucide-react";
import {
  getPublicMenu,
  getSiteSettings,
} from "@/server/services/public-menu.service";
import { whatsappLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [menu, settings] = await Promise.all([getPublicMenu(), getSiteSettings()]);

  const wa = whatsappLink(
    settings.whatsappNumber,
    "Olá! Vim pelo site e quero fazer um pedido.",
  );

  // Pega até 3 categorias com itens pra preview na landing
  const categoryPreview = menu.slice(0, 3);
  const totalItems = menu.reduce((acc, c) => acc + c.items.length, 0);

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
                  className="inline-flex items-center gap-2 rounded-md border border-green-600 bg-white px-5 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  Pedir pelo WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center">
            <div className="relative h-72 w-72">
              <Image
                src="/logo.png"
                alt={settings.businessName}
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </section>

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
