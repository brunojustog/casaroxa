import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bus, MessageCircle } from "lucide-react";
import { EmporioEncomendaClient } from "@/components/public/emporio/EmporioEncomendaClient";
import { getSiteSettings } from "@/server/services/public-menu.service";
import { listOpenSupplyTrips } from "@/server/services/supply-trip.service";
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

  const [products, trips, settings, pickupPoints] = await Promise.all([
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
  ]);

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
