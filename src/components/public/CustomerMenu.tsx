"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, User, History } from "lucide-react";
import Link from "next/link";

export function CustomerMenu({
  customer,
}: {
  customer: { name: string; phone: string };
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const firstName = customer.name.split(/\s+/)[0];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/public/logout", { method: "POST" });
    } catch {
      /* */
    }
    // Hard reload pra limpar caches do SSR
    window.location.href = "/";
  }

  return (
    <div className="relative ml-1" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-roxa-200 bg-white px-3 py-2 text-xs font-medium text-roxa-800 hover:bg-roxa-50"
      >
        <User className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{firstName}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-slate-200 bg-white shadow-lg z-50">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-xs text-slate-500">Conectado como</p>
            <p className="text-sm font-medium text-slate-900 truncate">
              {customer.name}
            </p>
            <p className="text-[11px] text-slate-500 tabular-nums">
              {maskPhone(customer.phone)}
            </p>
          </div>
          <Link
            href="/meus-pedidos"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <History className="h-4 w-4" />
            Meus pedidos
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={loading}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {loading ? "Saindo…" : "Sair"}
          </button>
        </div>
      )}
    </div>
  );
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  const local = d.startsWith("55") ? d.slice(2) : d;
  if (local.length === 11)
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10)
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}
