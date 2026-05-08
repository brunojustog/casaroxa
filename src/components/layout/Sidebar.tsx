"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Carrot,
  Package,
  ClipboardList,
  Boxes,
  Calculator,
  TrendingUp,
  FileBarChart2,
  Settings as SettingsIcon,
  Upload,
  Warehouse,
  Truck,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",       label: "Dashboard",        icon: LayoutDashboard },
  { href: "/ingredientes",    label: "Ingredientes",     icon: Carrot },
  { href: "/produtos",        label: "Produtos",         icon: Package },
  { href: "/fichas-tecnicas", label: "Fichas Técnicas",  icon: ClipboardList },
  { href: "/combos",          label: "Combos",           icon: Boxes },
  { href: "/estoque",         label: "Estoque",          icon: Warehouse },
  { href: "/fornecedores",    label: "Fornecedores",     icon: Truck },
  { href: "/compras",         label: "Compras",          icon: ShoppingCart },
  { href: "/assistente",      label: "Assistente IA",    icon: Sparkles },
  { href: "/simulador",       label: "Simulador",        icon: Calculator },
  { href: "/cenarios",        label: "Cenários",         icon: TrendingUp },
  { href: "/relatorios",      label: "Relatórios",       icon: FileBarChart2 },
  { href: "/configuracoes",   label: "Configurações",    icon: SettingsIcon },
  { href: "/importar",        label: "Importar Planilha", icon: Upload },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="h-8 w-8 rounded-md bg-roxa-700 grid place-items-center text-white font-bold">
          C
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 leading-tight">Casa Roxa</p>
          <p className="text-[11px] text-slate-500 leading-tight">Gestão de Custos</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-roxa-50 text-roxa-800"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400">
        v0.5 — Assistente IA
      </div>
    </aside>
  );
}
