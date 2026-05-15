"use client";

import { useEffect, useState } from "react";
import { Clock, ChefHat, Package, Bike, Check } from "lucide-react";

type Stage = "NOVO" | "PREPARANDO" | "PRONTO" | "SAIU_ENTREGA" | "ENTREGUE";
const ORDER: Stage[] = ["NOVO", "PREPARANDO", "PRONTO", "SAIU_ENTREGA", "ENTREGUE"];

const COLUMN_LABEL: Record<Stage, string> = {
  NOVO: "Novos",
  PREPARANDO: "Preparando",
  PRONTO: "Prontos",
  SAIU_ENTREGA: "Saiu p/ entrega",
  ENTREGUE: "Entregues",
};

const COLUMN_ICON: Record<Stage, React.ReactNode> = {
  NOVO: <Clock className="h-3 w-3" />,
  PREPARANDO: <ChefHat className="h-3 w-3" />,
  PRONTO: <Package className="h-3 w-3" />,
  SAIU_ENTREGA: <Bike className="h-3 w-3" />,
  ENTREGUE: <Check className="h-3 w-3" />,
};

type Order = {
  id: number;
  number: string;
  customer: string;
  items: string;
  stage: Stage;
  age: number; // minutos
};

const INITIAL: Order[] = [
  { id: 1, number: "#142", customer: "João S.", items: "2× Frango, 1× Farofa", stage: "NOVO", age: 1 },
  { id: 2, number: "#141", customer: "Maria L.", items: "Combo Costela Casal", stage: "NOVO", age: 3 },
  { id: 3, number: "#140", customer: "Pedro M.", items: "1× Frango, 2× Refri", stage: "PREPARANDO", age: 12 },
  { id: 4, number: "#139", customer: "Ana C.", items: "1× Costela 1kg", stage: "PREPARANDO", age: 18 },
  { id: 5, number: "#138", customer: "Carlos R.", items: "Combo Domingão", stage: "PRONTO", age: 25 },
  { id: 6, number: "#137", customer: "Júlia P.", items: "1× Frango assado", stage: "SAIU_ENTREGA", age: 32 },
];

export function KdsScreen() {
  const [orders, setOrders] = useState<Order[]>(INITIAL);

  // Avança um pedido aleatório a cada 3s pra simular fluxo
  useEffect(() => {
    const interval = setInterval(() => {
      setOrders((prev) => {
        const movable = prev.filter((o) => o.stage !== "ENTREGUE");
        if (movable.length === 0) {
          // Reset
          return INITIAL.map((o) => ({ ...o }));
        }
        const pick = movable[Math.floor(Math.random() * movable.length)];
        const currentIdx = ORDER.indexOf(pick.stage);
        const nextStage = ORDER[Math.min(currentIdx + 1, ORDER.length - 1)];
        return prev.map((o) =>
          o.id === pick.id ? { ...o, stage: nextStage } : o,
        );
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-5 gap-2 p-3 bg-slate-100 min-h-[280px]">
      {ORDER.map((stage) => {
        const ofStage = orders.filter((o) => o.stage === stage);
        return (
          <div
            key={stage}
            className="rounded-md bg-white border border-slate-200 flex flex-col"
          >
            <header className="border-b border-slate-100 p-2">
              <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {COLUMN_ICON[stage]}
                {COLUMN_LABEL[stage]}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">
                {ofStage.length} pedido{ofStage.length !== 1 ? "s" : ""}
              </p>
            </header>
            <ul className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
              {ofStage.map((o) => (
                <li
                  key={o.id}
                  className="animate-fade-in rounded-md border border-slate-200 bg-roxa-50/40 p-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-roxa-700">
                      {o.number}
                    </span>
                    <span className="text-[9px] text-slate-500 tabular-nums">
                      {o.age}min
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-900 truncate">
                    {o.customer}
                  </p>
                  <p className="text-[9px] text-slate-600 line-clamp-2 leading-tight">
                    {o.items}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
