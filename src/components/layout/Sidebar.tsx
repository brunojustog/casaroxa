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
  Receipt,
  DollarSign,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { section: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    section: "Cadastros",
    items: [
      { href: "/ingredientes",    label: "Ingredientes",    icon: Carrot },
      { href: "/produtos",        label: "Produtos",        icon: Package },
      { href: "/fichas-tecnicas", label: "Fichas Técnicas", icon: ClipboardList },
      { href: "/combos",          label: "Combos",          icon: Boxes },
      { href: "/fornecedores",    label: "Fornecedores",    icon: Truck },
    ],
  },
  {
    section: "Operação",
    items: [
      { href: "/estoque",  label: "Estoque",  icon: Warehouse },
      { href: "/compras",  label: "Compras",  icon: ShoppingCart },
      { href: "/vendas",   label: "Vendas",   icon: DollarSign },
    ],
  },
  {
    section: "Financeiro",
    items: [
      { href: "/custos-fixos", label: "Custos Fixos",    icon: Receipt },
      { href: "/resultado",    label: "Resultado / DRE", icon: Activity },
      { href: "/cenarios",     label: "Cenários",        icon: TrendingUp },
      { href: "/simulador",    label: "Simulador",       icon: Calculator },
    ],
  },
  {
    section: "Análise",
    items: [
      { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
      { href: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
    ],
  },
  {
    section: "Ferramentas",
    items: [
      { href: "/assistente",    label: "Assistente IA", icon: Sparkles },
      { href: "/importar",      label: "Importar",      icon: Upload },
      { href: "/configuracoes", label: "Configurações", icon: SettingsIcon },
    ],
  },
];

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
          <p className="text-[11px] text-slate-500 leading-tight">Gestão</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-4">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {group.section}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
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
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400">
        Casa Roxa Gestão
      </div>
    </aside>
  );
}
