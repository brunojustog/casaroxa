/**
 * Layout simulado do painel admin (gestao.casaroxa.com.br):
 * sidebar à esquerda com o item ativo + cabeçalho com título + área principal.
 */
import { ReactNode } from "react";

type NavItem = { label: string; active?: boolean; section?: string };

const DEFAULT_NAV: NavItem[] = [
  { section: "CADASTROS", label: "Ingredientes" },
  { section: "CADASTROS", label: "Produtos" },
  { section: "CADASTROS", label: "Combos" },
  { section: "CADASTROS", label: "Encomendas" },
  { section: "CADASTROS", label: "Pré-vendas" },
  { section: "OPERAÇÃO", label: "Cozinha" },
  { section: "OPERAÇÃO", label: "Estoque" },
  { section: "OPERAÇÃO", label: "Produção" },
  { section: "OPERAÇÃO", label: "Vendas" },
  { section: "OPERAÇÃO", label: "Clientes" },
  { section: "OPERAÇÃO", label: "Campanhas" },
  { section: "OPERAÇÃO", label: "Avaliações" },
  { section: "FERRAMENTAS", label: "Assistente IA" },
  { section: "FERRAMENTAS", label: "Aprovações IA" },
  { section: "FERRAMENTAS", label: "Configurações" },
];

export function AdminShell({
  active,
  title,
  description,
  children,
}: {
  active: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const nav = DEFAULT_NAV.map((n) => ({ ...n, active: n.label === active }));

  // Agrupa por section
  const grouped = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    const key = item.section ?? "";
    (acc[key] = acc[key] ?? []).push(item);
    return acc;
  }, {});

  return (
    <div className="flex min-h-[400px] bg-slate-50">
      <aside className="hidden md:flex w-44 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-12 items-center gap-2 border-b border-slate-200 px-3">
          <div className="grid h-6 w-6 place-items-center rounded bg-roxa-700 text-white text-[10px] font-bold">
            C
          </div>
          <span className="text-xs font-semibold text-roxa-900">Casa Roxa</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-3">
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section}>
              {section && (
                <p className="px-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {section}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((it) => (
                  <li key={it.label}>
                    <span
                      className={
                        it.active
                          ? "flex items-center rounded-md bg-roxa-50 px-2 py-1 text-[11px] font-medium text-roxa-800"
                          : "flex items-center rounded-md px-2 py-1 text-[11px] text-slate-600"
                      }
                    >
                      {it.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="font-serif text-base font-bold text-slate-900">{title}</h2>
          {description && (
            <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
          )}
        </header>
        <div className="flex-1 p-4 bg-slate-50">{children}</div>
      </div>
    </div>
  );
}
