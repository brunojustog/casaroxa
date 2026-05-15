import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";

const PAGES = [
  { slug: "primeiros-passos", label: "Primeiros passos no painel", desc: "Login, navegação, o que você vê" },
  { slug: "kds", label: "Tela de cozinha (KDS)", desc: "Kanban em tempo real, polling 5s" },
  { slug: "vendas", label: "Atender e finalizar pedidos", desc: "Status, edição, cancelamento" },
  { slug: "cupons", label: "Gerar cupom manual", desc: "Como criar cupom pra cliente específico" },
  { slug: "estoque", label: "Lançar estoque e inventário", desc: "Movimentos, contagem, ajustes" },
  { slug: "ia", label: "Usar o assistente IA", desc: "Conversar com o sistema em linguagem natural" },
];

export default function OperadorPage() {
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
          Operador
        </p>
        <h1 className="font-serif text-3xl font-bold text-roxa-900">
          Guia do operador
        </h1>
        <p className="mt-1 text-slate-600 text-sm">
          Quem atende pedidos no dia-a-dia. Acesso restrito ao essencial operacional.
        </p>
      </header>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {PAGES.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/operador/${p.slug}`}
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
