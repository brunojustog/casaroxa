import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";

const PAGES = [
  { slug: "pedido", label: "Fazer um pedido", desc: "Cardápio, carrinho, checkout, pagamento" },
  { slug: "encomenda", label: "Encomendar com antecedência", desc: "Encomenda pra data futura (48h+)" },
  { slug: "pre-venda", label: "Pré-venda do fim de semana", desc: "Lote fechado com janelas de retirada" },
  { slug: "sorteio", label: "Participar de sorteio", desc: "Rifa grátis ou paga" },
  { slug: "meus-pedidos", label: "Meus pedidos (OTP)", desc: "Histórico + cupons + reorder" },
  { slug: "avaliacao", label: "Avaliar pedido (NPS)", desc: "Como funciona a avaliação pós-entrega" },
];

export default function ClientePage() {
  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3 w-3" /> Início
      </Link>
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-roxa-700">
          Cliente final
        </p>
        <h1 className="font-serif text-3xl font-bold text-roxa-900">
          Guia do cliente
        </h1>
        <p className="mt-1 text-slate-600 text-sm">
          Tudo que o cliente externo vê e faz no site público.
        </p>
      </header>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {PAGES.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/cliente/${p.slug}`}
              className="flex items-center gap-3 p-4 hover:bg-roxa-50/30"
            >
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{p.label}</p>
                <p className="text-xs text-slate-500">{p.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
