"use client";

import { useEffect, useRef, useState } from "react";

type DisplayItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type DisplayPayment = {
  id: string;
  method: string;
  label: string;
  amount: number;
  receivedAmount: number | null;
};

type DisplaySale = {
  id: string;
  number: number;
  status: "ABERTA" | "CONCLUIDA" | "CANCELADA";
  total: number;
  totalPaid: number;
  discount: number;
  troco: number;
  items: DisplayItem[];
  payments: DisplayPayment[];
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function qty(q: number) {
  return Number.isInteger(q)
    ? `${q} un`
    : `${q.toFixed(3).replace(".", ",")} kg`;
}

export function PdvClienteDisplay() {
  const [sale, setSale] = useState<DisplaySale | null>(null);
  const [erro, setErro] = useState(false);
  const lastItemsCount = useRef(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch("/api/pdv/atual", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { sale: DisplaySale | null };
        if (alive) {
          setSale(data.sale);
          setErro(false);
        }
      } catch {
        if (alive) setErro(true);
      }
    }
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Rola pro item mais novo quando entra um bip.
  useEffect(() => {
    const count = sale?.items.length ?? 0;
    if (count > lastItemsCount.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    lastItemsCount.current = count;
  }, [sale?.items.length]);

  // Tela de espera
  if (!sale) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-purple-900 to-purple-950 text-white">
        <Logo />
        <p className="mt-6 text-3xl font-light text-purple-200">
          {erro ? "Reconectando…" : "Bem-vindo à Casa Roxa!"}
        </p>
        <p className="mt-2 text-lg text-purple-300/70">
          Aguardando o próximo atendimento
        </p>
      </main>
    );
  }

  // Venda concluída — obrigado + troco
  if (sale.status === "CONCLUIDA") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-800 to-emerald-950 text-white">
        <p className="text-5xl font-bold">Obrigado! 💜</p>
        <p className="mt-4 text-3xl font-light text-emerald-100">
          Total: <span className="font-semibold tabular-nums">{brl(sale.total)}</span>
        </p>
        {sale.payments.length > 0 && (
          <p className="mt-2 text-2xl text-emerald-200">
            {sale.payments.map((p) => p.label).join(" + ")}
          </p>
        )}
        {sale.troco > 0 && (
          <p className="mt-6 rounded-2xl bg-white/15 px-10 py-5 text-4xl font-bold tabular-nums">
            Troco: {brl(sale.troco)}
          </p>
        )}
        <p className="mt-10 text-xl text-emerald-300/80">Volte sempre — Casa Roxa Assados</p>
      </main>
    );
  }

  // Venda em andamento
  const aCobrar = Math.max(0, sale.total - sale.discount);
  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-purple-900 to-purple-950 text-white">
      <header className="flex items-center justify-between px-8 py-5">
        <Logo small />
        <p className="text-xl text-purple-300">Compra #{sale.number}</p>
      </header>

      <ul
        ref={listRef}
        className="flex-1 space-y-2 overflow-y-auto px-8 pb-4 scroll-smooth"
      >
        {sale.items.length === 0 ? (
          <li className="pt-16 text-center text-2xl font-light text-purple-300/70">
            Vamos começar! 🛒
          </li>
        ) : (
          sale.items.map((it, idx) => (
            <li
              key={it.id}
              className="flex items-center gap-4 rounded-xl bg-white/10 px-5 py-3.5"
            >
              <span className="w-8 text-right text-lg tabular-nums text-purple-300">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-2xl font-medium">{it.name}</p>
                <p className="text-lg text-purple-300">
                  {qty(it.quantity)} × {brl(it.unitPrice)}
                </p>
              </div>
              <span className="text-2xl font-semibold tabular-nums">
                {brl(it.totalPrice)}
              </span>
            </li>
          ))
        )}
      </ul>

      <footer className="border-t border-white/15 bg-black/25 px-8 py-6">
        {sale.discount > 0 && (
          <div className="mb-1 flex items-baseline justify-between text-xl text-purple-200">
            <span>Desconto</span>
            <span className="tabular-nums">− {brl(sale.discount)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-light text-purple-100">TOTAL</span>
          <span className="text-6xl font-bold tabular-nums">{brl(aCobrar)}</span>
        </div>
        {sale.payments.length > 0 && (
          <div className="mt-3 flex items-baseline justify-between text-2xl text-purple-200">
            <span>{sale.payments.map((p) => p.label).join(" + ")}</span>
            {sale.troco > 0 ? (
              <span className="font-semibold text-emerald-300 tabular-nums">
                Troco: {brl(sale.troco)}
              </span>
            ) : (
              <span className="tabular-nums">Pago: {brl(sale.totalPaid)}</span>
            )}
          </div>
        )}
      </footer>
    </main>
  );
}

function Logo({ small }: { small?: boolean }) {
  return (
    <p className={`font-bold tracking-tight ${small ? "text-2xl" : "text-5xl"}`}>
      <span className="text-purple-300">Casa</span> Roxa
      <span className={small ? "text-base font-normal text-purple-400" : "text-2xl font-normal text-purple-400"}>
        {" "}
        Assados
      </span>
    </p>
  );
}
