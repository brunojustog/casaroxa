import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ExternalLink, Globe } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSiteMetrics, type SiteMetrics } from "@/server/services/metrics.service";

export const dynamic = "force-dynamic";

const PERIODOS = [
  { dias: 1, label: "Hoje" },
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
];

const EVENTO_LABELS: Record<string, string> = {
  "ver-produto": "Viu produto",
  "adicionar-carrinho": "Adicionou ao carrinho",
  "iniciar-checkout": "Iniciou checkout",
  "pedido-concluido": "Pedido concluído 🎉",
  "encomenda-enviada": "Encomenda enviada",
  "clique-whatsapp": "Clicou no WhatsApp",
  "app-notificacoes-ativadas": "Ativou o app 📱",
};

function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  if (anterior === 0) return null;
  const pct = ((atual - anterior) / anterior) * 100;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-green-700" : "text-red-600"}`}
      title="Comparado ao período anterior"
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function ListaRanking({
  titulo,
  linhas,
}: {
  titulo: string;
  linhas: { nome: string; valor: number }[];
}) {
  const max = Math.max(1, ...linhas.map((l) => l.valor));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {linhas.length === 0 ? (
          <p className="text-xs text-slate-400">Sem dados no período.</p>
        ) : (
          linhas.map((l) => (
            <div key={l.nome} className="relative overflow-hidden rounded-md">
              <div
                className="absolute inset-y-0 left-0 bg-roxa-100/70"
                style={{ width: `${(l.valor / max) * 100}%` }}
              />
              <div className="relative flex items-baseline justify-between gap-2 px-2.5 py-1.5 text-sm">
                <span className="truncate text-slate-700">{l.nome}</span>
                <span className="shrink-0 font-semibold tabular-nums text-roxa-900">
                  {l.valor}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const dias = PERIODOS.some((p) => p.dias === Number(params.dias))
    ? Number(params.dias)
    : 7;

  let m: SiteMetrics | null = null;
  let erro: string | null = null;
  try {
    m = await getSiteMetrics(dias);
  } catch (e) {
    erro = e instanceof Error ? e.message : "Painel de métricas indisponível.";
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Métricas do site"
        description="Visitas, origens e ações no casaroxa.com.br — dados do nosso painel próprio (Umami), sem cookies."
        actions={
          <a
            href="https://metricas.casaroxa.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-roxa-200 bg-white px-4 text-sm font-medium text-roxa-800 hover:bg-roxa-50"
          >
            <Globe className="h-4 w-4" />
            Painel completo
            <ExternalLink className="h-3 w-3" />
          </a>
        }
      />

      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.dias}
            href={`/metricas?dias=${p.dias}`}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              p.dias === dias
                ? "bg-roxa-700 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {erro && (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            Não consegui falar com o painel de métricas agora ({erro}). Tenta de
            novo em instantes — o site continua contando as visitas normalmente.
          </CardContent>
        </Card>
      )}

      {m && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Visitantes únicos
                </p>
                <p className="mt-1 flex items-baseline gap-2 text-3xl font-semibold text-slate-900 tabular-nums">
                  {m.visitantes}
                  <Variacao atual={m.visitantes} anterior={m.visitantesAnterior} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">Visitas</p>
                <p className="mt-1 flex items-baseline gap-2 text-3xl font-semibold text-slate-900 tabular-nums">
                  {m.visitas}
                  <Variacao atual={m.visitas} anterior={m.visitasAnterior} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Páginas vistas
                </p>
                <p className="mt-1 text-3xl font-semibold text-slate-900 tabular-nums">
                  {m.pageviews}
                </p>
              </CardContent>
            </Card>
          </div>

          {m.serieDiaria.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Visitas por dia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-28 items-end gap-1">
                  {m.serieDiaria.map((d) => {
                    const max = Math.max(1, ...m.serieDiaria.map((x) => x.visitantes));
                    return (
                      <div
                        key={d.dia}
                        className="group relative flex-1 rounded-t bg-roxa-300 transition hover:bg-roxa-500"
                        style={{ height: `${Math.max(4, (d.visitantes / max) * 100)}%` }}
                        title={`${new Date(d.dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}: ${d.visitantes} visitas`}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ListaRanking
              titulo="🧭 De onde vieram"
              linhas={m.origens.map((o) => ({ nome: o.nome, valor: o.visitantes }))}
            />
            <ListaRanking
              titulo="⚡ Ações no site (funil)"
              linhas={m.eventos.map((e) => ({
                nome: EVENTO_LABELS[e.nome] ?? e.nome,
                valor: e.total,
              }))}
            />
            <ListaRanking
              titulo="📄 Páginas mais vistas"
              linhas={m.paginas.map((p) => ({ nome: p.url, valor: p.visitas }))}
            />
            <ListaRanking
              titulo="📱 Dispositivos"
              linhas={m.dispositivos.map((d) => ({ nome: d.nome, valor: d.visitantes }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
