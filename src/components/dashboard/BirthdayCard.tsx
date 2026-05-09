"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Cake, Check, Copy, MessageCircle, Tag } from "lucide-react";
import { generateBirthdayCouponAction } from "@/server/actions/customers";
import { whatsappLink } from "@/lib/whatsapp";

type BirthdayCustomer = {
  id: string;
  name: string;
  phone: string;
  birthday: string; // ISO date
  totalSales: number;
};

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(d);
};

export function BirthdayCard({ customers }: { customers: BirthdayCustomer[] }) {
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
  }).format(new Date());

  if (customers.length === 0) {
    return (
      <div className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm">
        <header className="flex items-center gap-2 mb-2">
          <Cake className="h-4 w-4 text-roxa-700" />
          <h3 className="font-serif text-base font-semibold text-roxa-900">
            Aniversariantes de {monthLabel}
          </h3>
        </header>
        <p className="text-sm text-slate-500">
          Nenhum cliente com aniversário cadastrado neste mês.{" "}
          <Link href="/clientes" className="text-roxa-700 hover:underline">
            Ver todos os clientes
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm">
      <header className="flex items-center gap-2 mb-3">
        <Cake className="h-4 w-4 text-roxa-700" />
        <h3 className="font-serif text-base font-semibold text-roxa-900">
          Aniversariantes de {monthLabel} ({customers.length})
        </h3>
      </header>

      <ul className="divide-y divide-slate-100 -mx-2">
        {customers.map((c) => (
          <BirthdayRow key={c.id} customer={c} />
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-slate-500">
        Clique em <strong>Gerar cupom</strong> pra criar um cupom de 15% personalizado
        (válido até fim do mês). Depois envie pelo WhatsApp.
      </p>
    </div>
  );
}

function BirthdayRow({ customer }: { customer: BirthdayCustomer }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    startTransition(async () => {
      const res = await generateBirthdayCouponAction(customer.id);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      setCode(res.data?.code ?? null);
      router.refresh();
    });
  }

  function copy() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const wa = code
    ? whatsappLink(
        customer.phone,
        `Olá ${customer.name}! 🎂 A Casa Roxa preparou um cupom especial de aniversário pra você: *${code}* (15% off, válido até fim do mês). É só usar no nosso cardápio: https://casaroxa.com.br/cardapio`,
      )
    : null;

  return (
    <li className="flex items-center justify-between gap-3 px-2 py-2.5">
      <div className="flex-1 min-w-0">
        <Link
          href={`/clientes/${customer.id}`}
          className="text-sm font-medium text-slate-900 hover:text-roxa-700"
        >
          {customer.name}
        </Link>
        <p className="text-[11px] text-slate-500">
          🎂 {fmtDay(customer.birthday)} · {customer.totalSales} pedido
          {customer.totalSales === 1 ? "" : "s"}
        </p>
      </div>
      {code ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-mono font-semibold text-amber-900 hover:bg-amber-100"
            title="Copiar código"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {code}
          </button>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
              title="Abrir no WhatsApp"
            >
              <MessageCircle className="h-3 w-3" />
            </a>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-roxa-300 bg-white px-2.5 py-1 text-xs font-medium text-roxa-700 hover:bg-roxa-50 disabled:opacity-50"
        >
          <Tag className="h-3 w-3" />
          {pending ? "…" : "Gerar cupom"}
        </button>
      )}
    </li>
  );
}
