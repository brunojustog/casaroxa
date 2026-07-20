/**
 * API de Conversões do Meta (CAPI) — envia eventos servidor→Meta em
 * paralelo aos do Pixel no navegador. A deduplicação acontece pelo par
 * (event_name, event_id): o navegador manda Purchase com
 * eventID `purchase-<saleId>` e Lead com `lead-<id>`; aqui mandamos os
 * mesmos ids, então o Meta conta o evento uma vez só — mas com a
 * confiabilidade do servidor (imune a bloqueador de anúncio/iOS).
 *
 * Sem META_CAPI_TOKEN configurado, tudo vira no-op silencioso (dev/local).
 * Envio é fire-and-forget: falha de CAPI nunca pode quebrar um pedido.
 */

const PIXEL_ID = process.env.META_PIXEL_ID ?? "1426004342688984";
const GRAPH_URL = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;

export type CapiRequestContext = {
  /** IP do cliente (x-forwarded-for) e user-agent — melhoram o match. */
  clientIp?: string | null;
  userAgent?: string | null;
  /** Cookies _fbp/_fbc do navegador — identificam o browser/click no Meta. */
  fbp?: string | null;
  fbc?: string | null;
  sourceUrl?: string | null;
};

/** Extrai contexto de atribuição de uma Request do route handler. */
export function capiContextFromRequest(request: Request): CapiRequestContext {
  const cookies = request.headers.get("cookie") ?? "";
  const cookie = (name: string): string | null => {
    const m = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  };
  return {
    clientIp:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
    fbp: cookie("_fbp"),
    fbc: cookie("_fbc"),
    sourceUrl: request.headers.get("referer"),
  };
}

type CapiEvent = {
  eventName: "Purchase" | "Lead";
  eventId: string;
  value: number;
  currency?: string;
  context: CapiRequestContext;
};

/** Fire-and-forget — nunca lança; loga falhas no console do servidor. */
export function sendMetaEvent(ev: CapiEvent): void {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;

  const userData: Record<string, unknown> = {};
  if (ev.context.clientIp) userData.client_ip_address = ev.context.clientIp;
  if (ev.context.userAgent) userData.client_user_agent = ev.context.userAgent;
  if (ev.context.fbp) userData.fbp = ev.context.fbp;
  if (ev.context.fbc) userData.fbc = ev.context.fbc;

  const payload = {
    data: [
      {
        event_name: ev.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: ev.eventId,
        action_source: "website",
        event_source_url: ev.context.sourceUrl ?? "https://casaroxa.com.br",
        user_data: userData,
        custom_data: {
          value: ev.value,
          currency: ev.currency ?? "BRL",
        },
      },
    ],
    // Habilita teste no Gerenciador de Eventos sem poluir dados reais.
    ...(process.env.META_CAPI_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE }
      : {}),
  };

  void fetch(`${GRAPH_URL}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[meta-capi] ${ev.eventName} falhou (${res.status}): ${body.slice(0, 300)}`);
      }
    })
    .catch((e) => {
      console.error(`[meta-capi] ${ev.eventName} erro de rede:`, e?.message ?? e);
    });
}
