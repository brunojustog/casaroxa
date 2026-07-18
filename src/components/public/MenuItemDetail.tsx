"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CalendarClock, ChevronLeft, ImageOff, UtensilsCrossed } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { youtubeEmbedUrl } from "@/lib/youtube";
import { MenuItemActions } from "./cart/MenuItemActions";
import { ShareButton } from "./ShareButton";
import type { PublicMenuItem } from "@/server/services/public-menu.service";

export function MenuItemDetail({ item }: { item: PublicMenuItem }) {
  // Galeria: foto principal + adicionais (sem duplicar)
  const allPhotos = [
    ...(item.imageUrl ? [item.imageUrl] : []),
    ...item.gallery.filter((g) => g !== item.imageUrl),
  ];
  const [activePhoto, setActivePhoto] = useState(0);
  const mainPhoto = allPhotos[activePhoto] ?? null;
  const embed = youtubeEmbedUrl(item.youtubeUrl);

  return (
    <div className="space-y-8">
      <Link
        href="/cardapio"
        className="inline-flex items-center gap-1 text-sm text-roxa-700 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar ao cardápio
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Galeria */}
        <div className="space-y-3">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-roxa-100 bg-roxa-50">
            {mainPhoto ? (
              <Image
                src={mainPhoto}
                alt={item.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-roxa-300">
                <ImageOff className="h-12 w-12" />
              </div>
            )}
            {item.kind === "COMBO" && (
              <span className="absolute left-4 top-4 rounded-full bg-roxa-700 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow">
                Combo
              </span>
            )}
            {item.sobEncomenda && (
              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow">
                <CalendarClock className="h-3.5 w-3.5" />
                Sob encomenda
              </span>
            )}
          </div>
          {allPhotos.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {allPhotos.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setActivePhoto(i)}
                  className={
                    i === activePhoto
                      ? "relative h-16 w-16 overflow-hidden rounded-md ring-2 ring-roxa-700"
                      : "relative h-16 w-16 overflow-hidden rounded-md ring-1 ring-roxa-100 hover:ring-roxa-300"
                  }
                  aria-label={`Foto ${i + 1}`}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-5">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-serif text-3xl font-bold text-roxa-900 md:text-4xl">
                {item.name}
              </h1>
              <ShareButton
                title={item.name}
                text={item.description ?? item.ingredientsPublic ?? item.name}
                className="mt-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-roxa-200 bg-white px-3 py-1.5 text-xs font-medium text-roxa-800 hover:bg-roxa-50"
              />
            </div>
            {item.portionLabel && (
              <p className="text-sm text-slate-500">{item.portionLabel}</p>
            )}
          </div>

          {item.description && (
            <p className="text-base leading-relaxed text-slate-700">
              {item.description}
            </p>
          )}

          {item.ingredientsPublic && (
            <div className="rounded-lg border border-roxa-100 bg-roxa-50/50 p-4">
              <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-roxa-700">
                <UtensilsCrossed className="h-3.5 w-3.5" />
                Ingredientes
              </h2>
              <p className="text-sm text-slate-700">{item.ingredientsPublic}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-roxa-100 pt-5">
            <span className="text-3xl font-bold tabular-nums text-roxa-700">
              {formatBRL(item.price)}
            </span>
            {item.sobEncomenda ? (
              <Link
                href="/encomenda"
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
              >
                <CalendarClock className="h-4 w-4" />
                Fazer encomenda
              </Link>
            ) : (
              <MenuItemActions
                item={{
                  id: item.id,
                  kind: item.kind,
                  name: item.name,
                  price: item.price,
                  imageUrl: item.imageUrl,
                }}
              />
            )}
          </div>

          {item.sobEncomenda && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Este item é preparado sob encomenda. Faça seu pedido com
              antecedência e a Casa Roxa confirma a data de retirada ou entrega.
            </p>
          )}
        </div>
      </div>

      {/* Vídeo do YouTube */}
      {embed && (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl font-semibold text-roxa-900">
            Veja o preparo
          </h2>
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-roxa-100 bg-black">
            <iframe
              src={embed}
              title={`Vídeo: ${item.name}`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </section>
      )}
    </div>
  );
}
