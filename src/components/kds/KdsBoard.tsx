"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Clock,
  ChefHat,
  CheckCircle2,
  Truck,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { setSaleProgressAction } from "@/server/actions/sales";

type SaleProgress =
  | "NOVO"
  | "CONFIRMADO"
  | "PREPARANDO"
  | "PRONTO"
  | "SAIU_ENTREGA"
  | "ENTREGUE";

type Order = {
  id: string;
  number: number;
  progress: SaleProgress;
  progressUpdatedAt: string | null;
  progressEstimateMinutes: number | null;
  occurredAt: string;
  customerName: string;
  notes: string | null;
  paid: boolean;
  items: Array<{ id: string; name: string; quantity: number; notes: string | null }>;
};

const POLL_MS = 5000;

const COLUMNS: Array<{
  key: Exclude<SaleProgress, "ENTREGUE">;
  label: string;
  icon: typeof Clock;
  color: string;
  next: SaleProgress | null;
  nextLabel: string;
}> = [
  {
    key: "NOVO",
    label: "Recebido",
    icon: AlertCircle,
    color: "border-amber-300 bg-amber-50",
    next: "CONFIRMADO",
    nextLabel: "Confirmar",
  },
  {
    key: "CONFIRMADO",
    label: "Confirmado",
    icon: Clock,
    color: "border-blue-300 bg-blue-50",
    next: "PREPARANDO",
    nextLabel: "Iniciar produção",
  },
  {
    key: "PREPARANDO",
    label: "Preparando",
    icon: ChefHat,
    color: "border-orange-300 bg-orange-50",
    next: "PRONTO",
    nextLabel: "Marcar pronto",
  },
  {
    key: "PRONTO",
    label: "Pronto",
    icon: CheckCircle2,
    color: "border-green-300 bg-green-50",
    next: "SAIU_ENTREGA",
    nextLabel: "Saiu pra entrega",
  },
  {
    key: "SAIU_ENTREGA",
    label: "Em entrega",
    icon: Truck,
    color: "border-purple-300 bg-purple-50",
    next: "ENTREGUE",
    nextLabel: "Entregue",
  },
];

export function KdsBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/kds", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Erro ao carregar");
        return;
      }
      setOrders(json.orders);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede");
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling 5s
  useEffect(() => {
    void fetchOrders();
    pollRef.current = setInterval(() => void fetchOrders(), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchOrders]);

  // Tick "now" a cada 30s pra atualizar tempos decorridos
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  function advance(orderId: string, nextProgress: SaleProgress) {
    startTransition(async () => {
      const res = await setSaleProgressAction(orderId, {
        progress: nextProgress,
      });
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      void fetchOrders();
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Carregando pedidos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error}
        <button
          onClick={() => void fetchOrders()}
          className="ml-2 underline"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  // Agrupa por progress
  const byCol: Record<string, Order[]> = {};
  for (const col of COLUMNS) byCol[col.key] = [];
  for (const o of orders) {
    if (byCol[o.progress]) byCol[o.progress].push(o);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {orders.length} pedido(s) ativos · atualiza a cada 5s
        </p>
        <button
          type="button"
          onClick={() => void fetchOrders()}
          className="inline-flex items-center gap-1 text-xs text-roxa-700 hover:underline"
          disabled={pending}
        >
          <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />
          atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const colOrders = byCol[col.key] ?? [];
          const Icon = col.icon;
          return (
            <div
              key={col.key}
              className={`rounded-lg border-2 ${col.color} p-2 min-h-[200px] flex flex-col`}
            >
              <header className="flex items-center justify-between px-1 py-1 mb-2">
                <div className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                  <Icon className="h-4 w-4" />
                  {col.label}
                </div>
                <span className="rounded-full bg-white border border-slate-300 px-1.5 text-xs tabular-nums">
                  {colOrders.length}
                </span>
              </header>
              <div className="space-y-2 flex-1">
                {colOrders.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-4">
                    sem pedidos
                  </p>
                ) : (
                  colOrders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      now={now}
                      nextProgress={col.next}
                      nextLabel={col.nextLabel}
                      onAdvance={advance}
                      pending={pending}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  now,
  nextProgress,
  nextLabel,
  onAdvance,
  pending,
}: {
  order: Order;
  now: number;
  nextProgress: SaleProgress | null;
  nextLabel: string;
  onAdvance: (id: string, next: SaleProgress) => void;
  pending: boolean;
}) {
  const since = order.progressUpdatedAt
    ? new Date(order.progressUpdatedAt).getTime()
    : new Date(order.occurredAt).getTime();
  const elapsedMin = Math.floor((now - since) / 60000);
  const isLate = elapsedMin > 30;

  return (
    <div className="rounded-md border border-slate-300 bg-white p-2 shadow-sm">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-mono font-bold text-sm text-roxa-900">
          #{order.number}
        </span>
        <span
          className={`text-[10px] font-mono tabular-nums ${isLate ? "text-red-600 font-bold" : "text-slate-500"}`}
        >
          ⏱ {elapsedMin}m
        </span>
      </div>
      <p className="text-xs font-medium text-slate-800 truncate">
        {order.customerName}
      </p>
      <ul className="mt-1 space-y-0.5 text-[11px] text-slate-700">
        {order.items.map((it) => (
          <li key={it.id}>
            <span className="font-bold">
              {it.quantity % 1 === 0 ? it.quantity : it.quantity.toFixed(2)}×
            </span>{" "}
            {it.name}
            {it.notes && (
              <span className="block ml-3 text-[10px] italic text-slate-500">
                📝 {it.notes}
              </span>
            )}
          </li>
        ))}
      </ul>
      {order.notes && (
        <p className="mt-1 text-[10px] italic text-slate-500 border-t border-slate-100 pt-1">
          📝 {order.notes}
        </p>
      )}
      {!order.paid && (
        <p className="mt-1 text-[10px] font-semibold text-amber-700">
          ⚠ Aguardando pagamento
        </p>
      )}
      {nextProgress && (
        <button
          type="button"
          onClick={() => onAdvance(order.id, nextProgress)}
          disabled={pending}
          className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md bg-roxa-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-roxa-800 disabled:opacity-50"
        >
          {nextLabel}
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
