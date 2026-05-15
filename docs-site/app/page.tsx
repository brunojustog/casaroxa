import Link from "next/link";
import {
  UserCheck,
  ChefHat,
  Briefcase,
  ArrowRight,
  BookOpen,
} from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-8">
      <header className="text-center py-6">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-roxa-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-roxa-700">
          <BookOpen className="h-3 w-3" /> Manual interno
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-roxa-900">
          Casa Roxa Gestão
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Guia operacional do sistema — escolha sua audiência abaixo.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/cliente"
          className="group rounded-xl border-2 border-slate-200 bg-white p-6 transition hover:border-roxa-300 hover:shadow-md"
        >
          <UserCheck className="h-8 w-8 text-roxa-700 mb-3" />
          <h2 className="font-serif text-xl font-bold text-roxa-900">
            Cliente final
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Como o cliente externo usa o site (pedido, encomenda, sorteio, NPS).
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-roxa-700 group-hover:gap-2 transition-all">
            Ver guia <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
        <Link
          href="/operador"
          className="group rounded-xl border-2 border-slate-200 bg-white p-6 transition hover:border-roxa-300 hover:shadow-md"
        >
          <ChefHat className="h-8 w-8 text-roxa-700 mb-3" />
          <h2 className="font-serif text-xl font-bold text-roxa-900">
            Operador
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Quem atende pedidos no dia-a-dia. Acesso restrito ao essencial.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-roxa-700 group-hover:gap-2 transition-all">
            Ver guia <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
        <Link
          href="/admin"
          className="group rounded-xl border-2 border-slate-200 bg-white p-6 transition hover:border-roxa-300 hover:shadow-md"
        >
          <Briefcase className="h-8 w-8 text-roxa-700 mb-3" />
          <h2 className="font-serif text-xl font-bold text-roxa-900">Admin</h2>
          <p className="mt-1 text-sm text-slate-600">
            Acesso total: cardápio, finanças, campanhas, IA, configurações.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-roxa-700 group-hover:gap-2 transition-all">
            Ver guia <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-serif text-lg font-semibold text-slate-900">
          Como o manual está organizado
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>
            ▶️ Cada função do sistema tem sua página dedicada com passo-a-passo
          </li>
          <li>
            🖥️ Mockups das telas simulam a interface real com o estado em cada
            momento do fluxo
          </li>
          <li>
            🔀 Fluxos de status (pedido, encomenda, IA) usam diagramas
            Mermaid pra facilitar entender as transições
          </li>
          <li>
            ⚠️ Avisos importantes ficam destacados em amarelo, dicas em azul,
            detalhes técnicos em cinza
          </li>
        </ul>
      </section>

      <p className="text-center text-xs text-slate-400">
        Versão Maio/2026 · pré-launch
      </p>
    </div>
  );
}
