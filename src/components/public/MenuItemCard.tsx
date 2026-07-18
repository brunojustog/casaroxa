import Image from "next/image";
import Link from "next/link";
import { CalendarClock, Flame, ImageOff, PiggyBank } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { MenuItemActions } from "./cart/MenuItemActions";
import type { PublicMenuItem } from "@/server/services/public-menu.service";

export function MenuItemCard({ item }: { item: PublicMenuItem }) {
  const detailHref =
    item.kind === "PRODUTO"
      ? `/cardapio/produto/${item.id}`
      : `/cardapio/combo/${item.id}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-roxa-100 bg-white shadow-sm transition hover:shadow-md">
      <Link href={detailHref} className="relative block aspect-[4/3] w-full overflow-hidden bg-roxa-50">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-roxa-300">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">Sem foto</span>
          </div>
        )}
        {item.kind === "COMBO" && (
          <span className="absolute left-3 top-3 rounded-full bg-roxa-700 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white shadow">
            Combo
          </span>
        )}
        {item.sobEncomenda && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-600 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white shadow">
            <CalendarClock className="h-3 w-3" />
            Sob encomenda
          </span>
        )}
        {item.topPick && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow">
            <Flame className="h-3 w-3" />
            Mais pedido
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={detailHref} className="hover:text-roxa-700">
          <h3 className="font-serif text-lg font-semibold text-roxa-900">{item.name}</h3>
        </Link>
        {item.portionLabel && (
          <p className="text-xs text-slate-500">{item.portionLabel}</p>
        )}
        {item.description && (
          <p className="text-sm text-slate-600 line-clamp-3">{item.description}</p>
        )}
        <Link
          href={detailHref}
          className="text-xs font-medium text-roxa-700 hover:underline"
        >
          Ver detalhes →
        </Link>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-2">
          <div className="flex flex-col">
            <span className="text-2xl font-bold tabular-nums text-roxa-700">
              {formatBRL(item.price)}
            </span>
            {item.savings && item.savings > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700">
                <PiggyBank className="h-3 w-3" />
                Economize {formatBRL(item.savings)}
              </span>
            )}
          </div>
          {item.sobEncomenda ? (
            <Link
              href="/encomenda"
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
            >
              <CalendarClock className="h-4 w-4" />
              Encomendar
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
      </div>
    </article>
  );
}
