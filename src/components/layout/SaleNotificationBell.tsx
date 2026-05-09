"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ShoppingBag } from "lucide-react";

type LatestOrder = {
  id: string;
  number: number;
  customerName: string | null;
  total: number;
  itemCount: number;
  createdAt: string;
};

type Notifications = {
  count: number;
  latest: LatestOrder[];
};

const POLL_INTERVAL_MS = 30_000;
const STORAGE_KEY = "casaroxa.lastSeenOrders.v1";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} d`;
}

/**
 * Sino de notificações no header do admin.
 * Faz polling em /api/admin/sales/notifications a cada 30s e mostra
 * dropdown com os últimos pedidos do site em status NOVO.
 *
 * Quando count cresce comparado ao último valor visto (sessionStorage),
 * pulsa visualmente. Não toca som — pode ser distraente em uso real.
 */
export function SaleNotificationBell() {
  const [data, setData] = useState<Notifications>({ count: 0, latest: [] });
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const lastCountRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    async function tick() {
      try {
        const res = await fetch("/api/admin/sales/notifications", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json.ok) return;

        const next: Notifications = { count: json.count, latest: json.latest };

        // Pulsa se subiu vs último valor visto.
        const lastSeen = (() => {
          try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            return raw ? Number(raw) : 0;
          } catch {
            return 0;
          }
        })();

        if (next.count > lastSeen && next.count > (lastCountRef.current ?? 0)) {
          setPulse(true);
          setTimeout(() => setPulse(false), 4000);
        }
        lastCountRef.current = next.count;
        setData(next);
      } catch {
        /* offline ou erro de rede — silencioso */
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }
    // primeira chamada quase imediata
    timer = setTimeout(tick, 1000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!open) return;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle() {
    setOpen((v) => !v);
    setPulse(false);
    // marca como visto
    try {
      sessionStorage.setItem(STORAGE_KEY, String(data.count));
    } catch {
      /* ignora */
    }
  }

  const hasNew = data.count > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggle}
        className={
          pulse
            ? "relative inline-flex h-9 w-9 items-center justify-center rounded-md text-roxa-700 hover:bg-slate-100 animate-pulse"
            : "relative inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }
        aria-label={`Notificações${hasNew ? ` (${data.count} novo${data.count === 1 ? "" : "s"})` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {hasNew && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow ring-2 ring-white">
            {data.count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-900">
              Pedidos novos
            </span>
            <Link
              href="/vendas?status=ABERTA&source=SITE"
              className="text-xs text-roxa-700 hover:underline"
              onClick={() => setOpen(false)}
            >
              Ver todos
            </Link>
          </div>
          {data.latest.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Nenhum pedido novo do site.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {data.latest.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/vendas/${o.id}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                    onClick={() => setOpen(false)}
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-roxa-100 text-roxa-700">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        Pedido #{o.number}
                        {o.customerName && (
                          <span className="text-slate-500 font-normal">
                            {" "}· {o.customerName}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {o.itemCount} item{o.itemCount === 1 ? "" : "s"} ·{" "}
                        {fmt(o.total)} · {relativeTime(o.createdAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
