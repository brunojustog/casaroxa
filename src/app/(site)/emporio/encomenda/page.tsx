import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Bus, MessageCircle, ShoppingBasket, Store } from "lucide-react";
import { EmporioEncomendaClient } from "@/components/public/emporio/EmporioEncomendaClient";
import { getSiteSettings } from "@/server/services/public-menu.service";
import { listOpenSupplyTrips } from "@/server/services/supply-trip.service";
import { getAllStockBalances } from "@/server/services/stock.service";
import { whatsappLink } from "@/lib/whatsapp";
import { formatBRL } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Encomenda do empório",
  description:
    "Encomende queijos, doces e quitutes mineiros — buscamos em Minas na próxima viagem.",
};

export default async function EmporioEncomendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pontoSlug = typeof sp.ponto === "string" ? sp.ponto : null;

  const [products, trips, settings, pickupPoints, allEmporio, balances] =
    await Promise.all([
      prisma.product.findMany({
        where: {
          active: true,
          showInMenu: true,
          salePrice: { gt: 0 },
          category: "EMPORIO",
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          salePrice: true,
          portionLabel: true,
          status: true,
        },
      }),
      listOpenSupplyTrips(3),
      getSiteSettings(),
      prisma.pickupPoint.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, slug: true, name: true, schedule: true },
      }),
      // Pronta entrega: tudo do empório com estoque na loja AGORA (com ou
      // sem foto — é vitrine de disponibilidade, não cardápio).
      prisma.product.findMany({
        where: { active: true, salePrice: { gt: 0 }, category: "EMPORIO" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          salePrice: true,
          portionLabel: true,
          recipe: {
            select: { items: { take: 1, select: { ingredientId: true, unit: true } } },
          },
        },
      }),
      getAllStockBalances(),
    ]);

  // Itens por unidade com saldo > 0. Itens por kg (queijos etc.) entram com
  // saldo em kg quando houver movimentação de estoque.
  const prontaEntrega = allEmporio
    .map((p) => {
      const item = p.recipe?.items[0];
      const saldo = item ? (balances.get(item.ingredientId) ?? 0) : 0;
      const byWeight =
        item?.unit === "KG" || (p.portionLabel ?? "").toLowerCase().includes("kg");
      return {
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        price: Number(p.salePrice ?? 0),
        portionLabel: p.portionLabel,
        saldo,
        byWeight,
      };
    })
    .filter((p) => p.saldo > 0.001);

  const waBase = settings.whatsappNumber;

  const catalog = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    priceCents: Math.round(Number(p.salePrice ?? 0) * 100),
    portionLabel: p.portionLabel,
    sobEncomenda: p.status === "SOB_ENCOMENDA",
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-3 rounded-xl border-2 border-amber-200 bg-amber-50/60 p-5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
          <Bus className="h-3 w-3" />
          Encomenda do empório
        </div>
        <h1 className="font-serif text-2xl font-bold text-roxa-900">
          Encomendar do empório
        </h1>
        <p className="text-sm text-slate-700">
          Os produtos do empório vêm de Minas Gerais — fazemos a viagem de
          compra cerca de duas vezes por mês. Escolha a viagem, monte sua
          lista e a gente traz pra você.
        </p>
      </header>

      {/* Pronta entrega: o que tem na loja AGORA */}
      {prontaEntrega.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 font-serif text-xl font-bold text-roxa-900">
              <Store className="h-5 w-5 text-roxa-700" />
              À pronta entrega na loja
            </h2>
            <p className="text-xs text-slate-500">
              Disponível agora — passa na loja ou reserva pelo WhatsApp.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {prontaEntrega.map((p) => {
              const wa = whatsappLink(
                waBase,
                `Oi! Quero reservar do empório: ${p.name} 😊`,
              );
              const card = (
                <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-roxa-300 hover:shadow-sm">
                  {p.imageUrl ? (
                    <div className="relative aspect-[4/3] w-full bg-slate-100">
                      <Image
                        src={p.imageUrl}
                        alt={p.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="grid aspect-[4/3] w-full place-items-center bg-roxa-50 text-roxa-300">
                      <ShoppingBasket className="h-8 w-8" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="text-sm font-medium leading-snug text-slate-900">
                      {p.name}
                    </p>
                    <p className="mt-auto text-sm font-semibold text-roxa-800">
                      {formatBRL(p.price)}
                      {p.byWeight ? (
                        <span className="text-xs font-normal text-slate-500"> /kg</span>
                      ) : (
                        p.portionLabel && (
                          <span className="text-xs font-normal text-slate-500">
                            {" "}
                            · {p.portionLabel}
                          </span>
                        )
                      )}
                    </p>
                    {!p.byWeight && p.saldo <= 3 && (
                      <p className="text-[11px] font-medium text-amber-700">
                        Últimas {p.saldo === 1 ? "unidade" : `${Math.floor(p.saldo)} unidades`}!
                      </p>
                    )}
                  </div>
                </div>
              );
              return wa ? (
                <a key={p.id} href={wa} target="_blank" rel="noopener noreferrer" title={`Reservar ${p.name} pelo WhatsApp`}>
                  {card}
                </a>
              ) : (
                <div key={p.id}>{card}</div>
              );
            })}
          </div>
        </section>
      )}

      {trips.length === 0 ? (
        <div className="space-y-4 rounded-xl border border-dashed border-amber-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-700">
            Ainda não há viagem marcada pra Minas. Assim que a próxima data for
            definida, as encomendas abrem aqui.
          </p>
          {settings.emporioWhatsappGroupUrl && (
            <a
              href={settings.emporioWhatsappGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" />
              Entrar no grupo e saber da próxima viagem
            </a>
          )}
          <div>
            <Link
              href="/emporio"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-roxa-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao empório
            </Link>
          </div>
        </div>
      ) : (
        <>
          {settings.emporioWhatsappGroupUrl && (
            <a
              href={settings.emporioWhatsappGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 hover:bg-green-100"
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-green-700" />
              <span>
                <strong>Grupo do empório no WhatsApp:</strong> avisamos das
                próximas viagens e novidades por lá. Toque pra entrar.
              </span>
            </a>
          )}
          <EmporioEncomendaClient
            catalog={catalog}
            trips={trips.map((t) => ({
              id: t.id,
              tripDate: t.tripDate.toISOString(),
              cutoffAt: t.cutoffAt.toISOString(),
              notes: t.notes,
            }))}
            deliveryEnabled={settings.deliveryEnabled}
            pickupEnabled={settings.pickupEnabled}
            pickupPoints={pickupPoints}
            defaultPointSlug={pontoSlug}
          />
        </>
      )}
    </div>
  );
}
