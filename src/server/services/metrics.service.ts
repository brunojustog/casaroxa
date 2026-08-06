/**
 * Métricas do site — consome a API do Umami self-hosted
 * (metricas.casaroxa.com.br) usando o token do link compartilhado,
 * então nenhuma credencial fica no app.
 */

const UMAMI_URL = process.env.UMAMI_URL ?? "https://metricas.casaroxa.com.br";
const TZ = "America/Sao_Paulo";

type ShareAuth = { token: string; websiteId: string };

// Cache do JWT de login (válido por bastante tempo; renovamos por hora)
let cachedAuth: { auth: ShareAuth; at: number } | null = null;

async function getShareAuth(): Promise<ShareAuth> {
  if (cachedAuth && Date.now() - cachedAuth.at < 60 * 60 * 1000) {
    return cachedAuth.auth;
  }
  const user = process.env.UMAMI_USERNAME;
  const pass = process.env.UMAMI_PASSWORD;
  const websiteId = process.env.UMAMI_WEBSITE_ID;
  if (!user || !pass || !websiteId) {
    throw new Error("credenciais do Umami não configuradas no ambiente");
  }
  const res = await fetch(`${UMAMI_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user, password: pass }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`login no Umami falhou (${res.status})`);
  const data = (await res.json()) as { token: string };
  const auth = { token: data.token, websiteId };
  cachedAuth = { auth, at: Date.now() };
  return auth;
}

async function umamiGet<T>(
  auth: ShareAuth,
  path: string,
  params: Record<string, string | number>,
): Promise<T> {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  );
  const res = await fetch(
    `${UMAMI_URL}/api/websites/${auth.websiteId}/${path}?${qs}`,
    {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: "no-store",
    },
  );
  if (res.status === 401) cachedAuth = null; // força novo login na próxima
  if (!res.ok) throw new Error(`Umami ${path} falhou (${res.status})`);
  return (await res.json()) as T;
}

export type SiteMetrics = {
  visitantes: number;
  visitantesAnterior: number;
  visitas: number;
  visitasAnterior: number;
  pageviews: number;
  serieDiaria: { dia: string; visitantes: number }[];
  origens: { nome: string; visitantes: number }[];
  paginas: { url: string; visitas: number }[];
  dispositivos: { nome: string; visitantes: number }[];
  eventos: { nome: string; total: number }[];
  periodoDias: number;
};

const ORIGEM_LABELS: Array<[RegExp, string]> = [
  [/instagram/i, "Instagram"],
  [/facebook|fb\.com/i, "Facebook"],
  [/google/i, "Google"],
  [/whatsapp|wa\.me/i, "WhatsApp"],
  [/^$/, "Direto / app"],
];

function labelOrigem(ref: string): string {
  for (const [re, label] of ORIGEM_LABELS) {
    if (re.test(ref)) return label;
  }
  return ref;
}

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Computador",
  mobile: "Celular",
  tablet: "Tablet",
  laptop: "Notebook",
};

/** Busca todas as métricas do período (em dias) num só pacote. */
export async function getSiteMetrics(dias: number): Promise<SiteMetrics> {
  const auth = await getShareAuth();
  const endAt = Date.now();
  const startAt = endAt - dias * 24 * 60 * 60 * 1000;
  const base = { startAt, endAt, timezone: TZ };

  const [stats, pageviews, referrers, urls, devices, events] = await Promise.all([
    umamiGet<{
      pageviews: number;
      visitors: number;
      visits: number;
      comparison: { pageviews: number; visitors: number; visits: number };
    }>(auth, "stats", base),
    umamiGet<{ sessions: { x: string; y: number }[] }>(auth, "pageviews", {
      ...base,
      unit: "day",
    }),
    umamiGet<{ x: string | null; y: number }[]>(auth, "metrics", {
      ...base,
      type: "referrer",
      limit: 8,
    }),
    umamiGet<{ x: string; y: number }[]>(auth, "metrics", {
      ...base,
      type: "path",
      limit: 8,
    }),
    umamiGet<{ x: string; y: number }[]>(auth, "metrics", {
      ...base,
      type: "device",
      limit: 5,
    }),
    umamiGet<{ x: string; y: number }[]>(auth, "metrics", {
      ...base,
      type: "event",
      limit: 12,
    }),
  ]);

  // agrupa origens pelo rótulo amigável
  const origensMap = new Map<string, number>();
  for (const r of referrers) {
    const label = labelOrigem(r.x ?? "");
    origensMap.set(label, (origensMap.get(label) ?? 0) + r.y);
  }

  return {
    visitantes: stats.visitors,
    visitantesAnterior: stats.comparison?.visitors ?? 0,
    visitas: stats.visits,
    visitasAnterior: stats.comparison?.visits ?? 0,
    pageviews: stats.pageviews,
    serieDiaria: pageviews.sessions.map((p) => ({
      dia: p.x,
      visitantes: p.y,
    })),
    origens: [...origensMap.entries()]
      .map(([nome, visitantes]) => ({ nome, visitantes }))
      .sort((a, b) => b.visitantes - a.visitantes),
    paginas: urls.map((u) => ({ url: u.x, visitas: u.y })),
    dispositivos: devices.map((d) => ({
      nome: DEVICE_LABELS[d.x] ?? d.x,
      visitantes: d.y,
    })),
    eventos: events.map((e) => ({ nome: e.x, total: e.y })),
    periodoDias: dias,
  };
}
