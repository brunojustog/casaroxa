import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ShoppingBasket, Store } from "lucide-react";
import { MenuItemCard } from "@/components/public/MenuItemCard";
import {
  getEmporioMenu,
  getSiteSettings,
} from "@/server/services/public-menu.service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, items] = await Promise.all([
    getSiteSettings(),
    getEmporioMenu(),
  ]);
  const ogImage = items.find((i) => i.imageUrl)?.imageUrl ?? "/logo.png";
  return {
    title: "Empório",
    description: `Queijos artesanais, doces caseiros e quitutes mineiros no Empório ${settings.businessName}. Compre online ou encomende.`,
    openGraph: {
      title: `Empório · ${settings.businessName}`,
      description:
        "Queijos artesanais, doces caseiros e quitutes mineiros — à pronta entrega ou por encomenda.",
      images: [{ url: ogImage, alt: `Empório ${settings.businessName}` }],
    },
    twitter: { images: [ogImage] },
  };
}

export default async function EmporioPage() {
  const items = await getEmporioMenu();
  const disponiveis = items.filter((i) => !i.sobEncomenda);
  const sobEncomenda = items.filter((i) => i.sobEncomenda);

  return (
    <div className="space-y-10">
      {/* Cabeçalho */}
      <header className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-roxa-50 px-6 py-10 md:px-10">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-800">
            <Store className="h-3.5 w-3.5" />
            Empório
          </div>
          <h1 className="font-serif text-4xl font-bold text-roxa-900 md:text-5xl">
            Empório Casa Roxa
          </h1>
          <p className="text-base text-slate-700">
            Queijos artesanais, doces caseiros, bolachinhas e quitutes de Minas
            — escolhidos a dedo pra acompanhar o seu assado ou presentear quem
            você gosta.
          </p>
        </div>
      </header>

      {/* Como funciona */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-roxa-100 bg-white p-4 shadow-sm">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-roxa-100 text-roxa-700">
            <ShoppingBasket className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-roxa-800">
              Pronta entrega
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Adicione ao carrinho e finalize junto com o seu pedido do
              cardápio.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-800">
              Sob encomenda
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Itens com o selo &ldquo;Sob encomenda&rdquo; são pedidos com
              antecedência —{" "}
              <Link href="/encomenda" className="font-medium text-amber-800 underline">
                faça sua encomenda aqui
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Produtos */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-roxa-200 bg-white p-10 text-center text-sm text-slate-600">
          O empório está sendo abastecido. Volte em breve!
        </div>
      ) : (
        <>
          {disponiveis.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-roxa-900">
                À pronta entrega
                <span className="ml-2 align-middle rounded-full bg-roxa-100 px-2 py-0.5 text-xs font-semibold text-roxa-700">
                  {disponiveis.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {disponiveis.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {sobEncomenda.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-roxa-900">
                Sob encomenda
                <span className="ml-2 align-middle rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {sobEncomenda.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sobEncomenda.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
