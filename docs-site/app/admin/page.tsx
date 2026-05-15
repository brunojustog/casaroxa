import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

const SECTIONS: { title: string; pages: { slug: string; label: string; desc: string }[] }[] = [
  {
    title: "Catálogo",
    pages: [
      { slug: "cardapio", label: "Cardápio: produtos, combos, fichas técnicas", desc: "Cadastrar e gerenciar o que vende" },
      { slug: "cupons", label: "Cupons e promoções", desc: "% ou R$ fixo, com limite e validade" },
    ],
  },
  {
    title: "Operação",
    pages: [
      { slug: "pedidos", label: "Pedidos e KDS", desc: "Lista de vendas + tela de cozinha" },
      { slug: "pre-vendas", label: "Pré-venda do fim de semana", desc: "Lote fechado coletivo, janelas, reserva" },
      { slug: "encomendas", label: "Encomendas", desc: "Pedido com data futura, sinal Asaas" },
      { slug: "producao", label: "Planejamento de produção", desc: "Agrega pedidos pra produção + compras" },
    ],
  },
  {
    title: "Estoque & Compras",
    pages: [
      { slug: "ingredientes", label: "Ingredientes e fichas técnicas", desc: "Cadeia de custo + cascata automática" },
      { slug: "compras-nfe", label: "Compras e NFe XML", desc: "Importar XML, alias matching, preview impacto" },
      { slug: "inventarios", label: "Inventários e estoque mínimo", desc: "Contagem cíclica, alertas" },
      { slug: "fornecedores", label: "Fornecedores", desc: "Cadastro CNPJ, contatos" },
    ],
  },
  {
    title: "Marketing & relacionamento",
    pages: [
      { slug: "clientes", label: "Clientes, fidelidade, aniversariantes", desc: "CRM, pontos, cupom automático" },
      { slug: "campanhas", label: "Campanhas e públicos", desc: "8 audiências fixas, atribuição via cupom" },
      { slug: "nps", label: "NPS pós-entrega", desc: "Avaliação 0-10 + ações por categoria" },
      { slug: "carrinhos-abandonados", label: "Carrinhos abandonados", desc: "Captura automática + WhatsApp recuperação" },
      { slug: "sorteios", label: "Sorteios e rifas", desc: "Pool fechado, prêmios múltiplos, indicação" },
    ],
  },
  {
    title: "Financeiro & análise",
    pages: [
      { slug: "financeiro", label: "Custos fixos e resultado (DRE)", desc: "Lançar despesas, ver lucro" },
      { slug: "simulador", label: "Simulador e cenários", desc: "E se mudar margem, escala, etc" },
      { slug: "relatorios", label: "Relatórios", desc: "Exportação CSV/PDF" },
    ],
  },
  {
    title: "Inteligência artificial",
    pages: [
      { slug: "chat-ia", label: "Chat IA — conversar com o sistema", desc: "Linguagem natural, read-only" },
      { slug: "aprovacoes-ia", label: "Aprovações da IA", desc: "Aprovar/rejeitar ações propostas" },
    ],
  },
  {
    title: "Configurações",
    pages: [
      { slug: "config-marca", label: "Marca e cardápio público", desc: "Nome, slogan, hero, endereço" },
      { slug: "config-whatsapp", label: "WhatsApp — conectar e toggles", desc: "QR Code, 11 toggles + master" },
      { slug: "config-asaas", label: "Pagamentos online (Asaas)", desc: "Habilitar PIX/cartão, TTL" },
      { slug: "config-encomendas", label: "Encomendas — antecedência mínima", desc: "Configurar lead time" },
      { slug: "config-carrinho", label: "Carrinho abandonado — janela", desc: "Quanto tempo esperar antes do WhatsApp" },
      { slug: "usuarios", label: "Usuários e permissões", desc: "Admin vs Operador" },
    ],
  },
  {
    title: "Operação de infraestrutura",
    pages: [
      { slug: "infra-backup", label: "Backup e restore", desc: "Como tirar e restaurar Postgres" },
      { slug: "infra-crons", label: "Crons em execução", desc: "4 crons rodando, agendamento" },
      { slug: "infra-troubleshooting", label: "Logs e troubleshooting", desc: "Quando algo dá errado" },
    ],
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3 w-3" /> Início
      </Link>
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-roxa-700">
          Administrador
        </p>
        <h1 className="font-serif text-3xl font-bold text-roxa-900">
          Guia do admin
        </h1>
        <p className="mt-1 text-slate-600 text-sm">
          Acesso total ao sistema. Cadastros, finanças, marketing, IA, configurações.
        </p>
      </header>
      {SECTIONS.map((sec) => (
        <section key={sec.title}>
          <h2 className="font-serif text-lg font-semibold text-slate-900 mb-2">
            {sec.title}
          </h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {sec.pages.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/admin/${p.slug}`}
                  className="flex items-center gap-3 p-3 hover:bg-roxa-50/30"
                >
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">
                      {p.label}
                    </p>
                    <p className="text-xs text-slate-500">{p.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
