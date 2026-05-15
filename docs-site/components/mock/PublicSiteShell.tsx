/**
 * Layout simulado do site público (casaroxa.com.br): header com navegação.
 */
import { ReactNode } from "react";

export function PublicSiteShell({
  active,
  children,
}: {
  active: "Início" | "Cardápio" | "Encomendar" | "Meus pedidos";
  children: ReactNode;
}) {
  const items: typeof active[] = ["Início", "Cardápio", "Encomendar", "Meus pedidos"];
  return (
    <div className="bg-roxa-50/30 min-h-[400px]">
      <header className="sticky top-0 z-10 border-b border-roxa-100 bg-roxa-50/90 backdrop-blur">
        <div className="flex h-12 items-center justify-between px-4 max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-roxa-700 text-white text-[10px] font-bold">
              CR
            </div>
            <span className="hidden sm:inline text-xs font-serif font-bold text-roxa-900">
              Casa Roxa Assados
            </span>
          </div>
          <nav className="flex items-center gap-0.5 text-[11px]">
            {items.map((it) => (
              <span
                key={it}
                className={
                  active === it
                    ? "rounded-md bg-roxa-700 px-2 py-1 text-white font-semibold"
                    : "rounded-md px-2 py-1 text-roxa-800"
                }
              >
                {it}
              </span>
            ))}
            <span className="ml-2 rounded-md bg-green-600 px-2 py-1 text-white text-[11px] font-semibold">
              WhatsApp
            </span>
          </nav>
        </div>
      </header>
      <div className="p-4 max-w-3xl mx-auto">{children}</div>
    </div>
  );
}
