import { LogOut } from "lucide-react";
import { auth, signOut } from "@/server/auth";
import { prisma } from "@/lib/prisma";

export async function Header() {
  const session = await auth();
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <h1 className="text-base font-semibold text-slate-900">
          {settings?.businessName ?? "Casa Roxa Assados"}
        </h1>
        <p className="text-xs text-slate-500">Gestão de Custos</p>
      </div>

      <div className="flex items-center gap-3">
        {session?.user && (
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{session.user.name}</p>
            <p className="text-[11px] text-slate-500">{session.user.email}</p>
          </div>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 h-9 text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
