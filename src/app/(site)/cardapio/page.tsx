import type { Metadata } from "next";
import Link from "next/link";
import { Gift, CalendarDays, ArrowRight, Clock } from "lucide-react";
import { MenuItemCard } from "@/components/public/MenuItemCard";
import { getPublicMenu, getSiteSettings } from "@/server/services/public-menu.service";
import { listOpenRaffles } from "@/server/services/raffle.service";
import { getActiveSalesEvent } from "@/server/services/sales-event.service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, menu] = await Promise.all([getSiteSettings(), getPublicMenu()]);
  const total = menu.reduce((acc, c) => acc + c.items.length, 0);
  const ogImage = menu.find((c) => c.coverImageUrl)?.coverImageUrl ?? "/logo.png";
  return {
    title: "Cardápio",
    description: `${total} item${total === 1 ? "" : "s"} disponíveis no cardápio da ${settings.businessName}.`,
    openGraph: {
      title: `Cardápio · ${settings.businessName}`,
      description: settings.siteSlogan ?? `${total} itens prontos para pedir.`,
      images: [{ url: ogImage, alt: `Cardápio ${settings.businessName}` }],
    },
    twitter: { images: [ogImage] },
  };
}

export default async function CardapioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const selectedCat = typeof sp.cat === "string" ? sp.cat : null;

  const [menu, settings, openRaffles, activeEvent] = await Promise.all([
    getPublicMenu(),
    getSiteSettings(),
    listOpenRaffles(),
    getActiveSalesEvent(),
  ]);

  const filtered = selectedCat
    ? menu.filter((c) => String(c.category) === selectedCat)
    : menu;
  const totalItems = filtered.reduce((acc, c) => acc + c.items.length, 0);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-4xl font-bold text-roxa-900">Cardápio</h1>
        <p className="text-sm text-slate-600">
          {totalItems > 0
            ? `${totalItems} item${totalItems === 1 ? "" : "s"} disponível${totalItems === 1 ? "" : "s"}.`
            : "Cardápio em preparação."}
          {settings.minimumOrderValue && settings.minimumOrderValue > 0 && (
            <>
              {" "}Pedido mínimo:{" "}
              <strong>
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(settings.minimumOrderValue)}
              </strong>
              .
            </>
          )}
        </p>
      </header>

      {/* Cozinha fechada agora: cardápio segue visível, pedido vira agendamento */}
      {settings.cardapioClosed && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-200 text-amber-700">
            <Clock className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-base font-semibold text-amber-900">
              Cozinha fechada agora — mas você já pode montar seu pedido
            </p>
            <p className="text-sm text-amber-800 mt-0.5">
              {settings.cardapioClosedMessage ??
                "Escolha os itens normalmente. No fim, você agenda a data e o horário de retirada ou entrega."}
              {settings.kitchenHoursSummary && (
                <> Cozinha: <strong>{settings.kitchenHoursSummary}</strong>.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Banner de pré-venda ativa */}
      {activeEvent && (
        <Link
          href="/pre-venda"
          className="flex items-start gap-3 rounded-xl border-2 border-roxa-300 bg-roxa-50 p-4 hover:bg-roxa-100 transition"
        >
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-roxa-200 text-roxa-700">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center rounded-full bg-roxa-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              📅 Pré-venda
            </div>
            <p className="font-serif text-base font-semibold text-roxa-900 mt-1">
              {activeEvent.name}
            </p>
            {activeEvent.description && (
              <p className="text-xs text-roxa-800 line-clamp-2">
                {activeEvent.description}
              </p>
            )}
            <p className="text-[11px] text-roxa-700 mt-0.5">
              Fecha em{" "}
              <strong>
                {new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(activeEvent.closesAt)}
              </strong>
            </p>
          </div>
          <span className="rounded-md bg-roxa-700 px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap inline-flex items-center gap-1">
            Ver pré-venda <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      )}

      {/* Banner de rifas/sorteios em andamento */}
      {openRaffles.length > 0 && (
        <section className="space-y-2">
          {openRaffles.map((r) => {
            const isPaid = r.ticketPriceCents > 0;
            const priceFmt = new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(r.ticketPriceCents / 100);
            const label = isPaid ? "Rifa" : "Sorteio grátis";
            const available = r.totalNumbers - r._count.entries;
            return (
              <Link
                key={r.id}
                href={`/sorteio/${r.id}`}
                className="flex items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 hover:bg-amber-100 transition"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-200 text-amber-700">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      🎟️ {label}
                    </span>
                    {isPaid && (
                      <span className="text-[11px] font-semibold text-amber-900">
                        {priceFmt} / número
                      </span>
                    )}
                  </div>
                  <p className="font-serif text-base font-semibold text-amber-900 mt-1">
                    {r.name}
                  </p>
                  {r.prizes.length > 0 && (
                    <p className="text-xs text-amber-800 line-clamp-1">
                      🎁 {r.prizes.length === 1
                        ? r.prizes[0].description
                        : `${r.prizes.length} prêmios — 1º: ${r.prizes[0].description}`}
                    </p>
                  )}
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    {available} de {r.totalNumbers}{" "}
                    {available === 1 ? "número disponível" : "números disponíveis"}{" "}
                    · até{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    }).format(r.closesAt)}
                  </p>
                </div>
                <span className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap">
                  {isPaid ? "Comprar números →" : "Participar →"}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {/* Filtros de categoria */}
      {menu.length > 1 && (
        <nav className="flex flex-wrap gap-2">
          <CategoryChip href="/cardapio" active={!selectedCat}>
            Todos
          </CategoryChip>
          {menu.map((cat) => (
            <CategoryChip
              key={cat.category}
              href={`/cardapio?cat=${encodeURIComponent(String(cat.category))}`}
              active={selectedCat === String(cat.category)}
            >
              {cat.label}
              <span className="ml-1.5 rounded-full bg-roxa-50 px-1.5 py-0.5 text-[10px] font-semibold text-roxa-700">
                {cat.items.length}
              </span>
            </CategoryChip>
          ))}
        </nav>
      )}

      {/* Cards agrupados por categoria */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-roxa-200 bg-white p-10 text-center text-sm text-slate-600">
          Nada por aqui ainda. Volte em breve!
        </div>
      ) : (
        filtered.map((cat) => (
          <section key={cat.category} className="space-y-4">
            <h2 className="font-serif text-2xl font-bold text-roxa-900">{cat.label}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cat.items.map((item) => (
                <MenuItemCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  kitchenDaysLabel={settings.kitchenDaysLabel}
                />
              ))}
            </div>
          </section>
        ))
      )}

    </div>
  );
}

function CategoryChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex items-center rounded-full bg-roxa-700 px-4 py-2 text-sm font-medium text-white"
          : "inline-flex items-center rounded-full border border-roxa-200 bg-white px-4 py-2 text-sm font-medium text-roxa-800 hover:bg-roxa-50"
      }
    >
      {children}
    </Link>
  );
}
