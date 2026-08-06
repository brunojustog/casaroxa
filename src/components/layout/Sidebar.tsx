"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Globe2,
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
  Users,
  ClipboardCheck,
  Tag,
  UsersRound,
  Gift,
  ChefHat,
  CalendarDays,
  Megaphone,
  Star,
  Bus,
  Smartphone,
  FileText,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Se omitido, item visível pra todos. */
  roles?: UserRole[];
};
type NavSection = {
  section: string;
  items: NavItem[];
  /** Se omitido, seção visível pra todos. */
  roles?: UserRole[];
};

const NAV: NavSection[] = [
  {
    section: "Cadastros",
    roles: ["ADMIN"],
    items: [
      { href: "/ingredientes",    label: "Ingredientes",    icon: Carrot },
      { href: "/produtos",        label: "Produtos",        icon: Package },
      { href: "/fichas-tecnicas", label: "Fichas Técnicas", icon: ClipboardList },
      { href: "/combos",          label: "Combos",          icon: Boxes },
      { href: "/fornecedores",    label: "Fornecedores",    icon: Truck },
      { href: "/cupons",          label: "Cupons",          icon: Tag },
      { href: "/sorteios",        label: "Sorteios",        icon: Gift },
      { href: "/pre-vendas",      label: "Pré-vendas",      icon: CalendarDays },
      { href: "/viagens",         label: "Viagens (empório)", icon: Bus },
    ],
  },
  {
    section: "Operação",
    items: [
      { href: "/pdv",         label: "PDV (Caixa)", icon: Calculator },
      { href: "/cozinha",     label: "Cozinha",     icon: ChefHat },
      { href: "/producao",    label: "Produção",    icon: ClipboardList, roles: ["ADMIN"] },
      { href: "/estoque",     label: "Estoque",     icon: Warehouse },
      { href: "/inventarios", label: "Inventário",  icon: ClipboardCheck },
      { href: "/compras",     label: "Compras",     icon: ShoppingCart, roles: ["ADMIN"] },
      { href: "/vendas",      label: "Vendas",      icon: DollarSign },
      { href: "/encomendas",  label: "Encomendas",  icon: ClipboardList },
      { href: "/clientes",    label: "Clientes",    icon: UsersRound },
      { href: "/campanhas",   label: "Campanhas",   icon: Megaphone, roles: ["ADMIN"] },
      { href: "/atendente",   label: "Atendente IA",  icon: Bot, roles: ["ADMIN"] },
      { href: "/notificacoes", label: "Notificações app", icon: Smartphone, roles: ["ADMIN"] },
      { href: "/avaliacoes",  label: "Avaliações",  icon: Star, roles: ["ADMIN"] },
      { href: "/carrinhos-abandonados", label: "Carrinhos perdidos", icon: ShoppingCart, roles: ["ADMIN"] },
    ],
  },
  {
    section: "Financeiro",
    roles: ["ADMIN"],
    items: [
      { href: "/fiscal",       label: "Fiscal (NFC-e)",  icon: FileText },
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
      { href: "/relatorios", label: "Relatórios", icon: FileBarChart2, roles: ["ADMIN"] },
      { href: "/metricas",   label: "Métricas do site", icon: Globe2, roles: ["ADMIN"] },
    ],
  },
  {
    section: "Ferramentas",
    items: [
      { href: "/assistente",    label: "Assistente IA", icon: Sparkles },
      { href: "/aprovacoes-ia", label: "Aprovações IA", icon: Sparkles, roles: ["ADMIN"] },
      { href: "/importar",      label: "Importar",      icon: Upload, roles: ["ADMIN"] },
      { href: "/usuarios",      label: "Usuários",      icon: Users, roles: ["ADMIN"] },
      { href: "/configuracoes", label: "Configurações", icon: SettingsIcon, roles: ["ADMIN"] },
    ],
  },
];

function canSee(role: UserRole, allowed?: UserRole[]) {
  if (!allowed) return true;
  return allowed.includes(role);
}

const STORAGE_KEY = "casaroxa-sidebar-sections";

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  const visible = NAV.map((g) => ({
    ...g,
    items: g.items.filter((it) => canSee(role, it.roles)),
  })).filter((g) => canSee(role, g.roles) && g.items.length > 0);

  // Preferência de aberto/recolhido por seção, salva no navegador.
  // Sem preferência: só a seção da página atual começa aberta.
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* preferência corrompida — ignora */
    }
  }, []);

  const hasActiveItem = (g: (typeof visible)[number]) =>
    g.items.some(
      (it) => pathname === it.href || pathname.startsWith(`${it.href}/`),
    );
  const isOpen = (g: (typeof visible)[number]) =>
    prefs[g.section] ?? hasActiveItem(g);

  const toggleSection = (g: (typeof visible)[number]) => {
    setPrefs((cur) => {
      const next = { ...cur, [g.section]: !(cur[g.section] ?? hasActiveItem(g)) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage cheio/indisponível — segue sem persistir */
      }
      return next;
    });
  };

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
          {visible.map((group) => {
            const open = isOpen(group);
            return (
              <div key={group.section}>
                <button
                  type="button"
                  onClick={() => toggleSection(group)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between rounded-md px-3 pb-1 pt-1 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600"
                >
                  {group.section}
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      open ? "rotate-180" : "",
                    )}
                  />
                </button>
                {open && (
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
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400">
        Casa Roxa Gestão
      </div>
    </aside>
  );
}
