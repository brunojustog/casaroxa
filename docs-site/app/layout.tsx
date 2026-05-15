import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Manual — Casa Roxa Gestão",
  description: "Manual de uso interno do sistema Casa Roxa Gestão.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen bg-slate-50">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-roxa-700 text-white font-bold">
                  C
                </div>
                <span className="font-serif text-base font-bold text-roxa-900">
                  Casa Roxa Gestão — Manual
                </span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link
                  href="/cliente"
                  className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-roxa-50 hover:text-roxa-900"
                >
                  Cliente
                </Link>
                <Link
                  href="/operador"
                  className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-roxa-50 hover:text-roxa-900"
                >
                  Operador
                </Link>
                <Link
                  href="/admin"
                  className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-roxa-50 hover:text-roxa-900"
                >
                  Admin
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mt-16 border-t border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-slate-500">
              Manual interno · Casa Roxa Assados · Lençóis Paulista/SP
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
