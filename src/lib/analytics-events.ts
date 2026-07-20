/**
 * Eventos de marketing do site público — dispara em paralelo pro
 * Meta Pixel (fbq) e pro GA4 (gtag), carregados pelo componente Analytics.
 *
 * Resiliência a ordem de carregamento (eventos disparados na montagem da
 * página correm ANTES das tags terceiras terminarem de carregar):
 *  - GA4: empurra direto no dataLayer no formato gtag (Arguments) — o
 *    gtag.js reprocessa tudo que chegou antes dele. Nunca se perde.
 *  - Pixel: se o fbq ainda não existe, o evento entra numa fila com retry
 *    (500ms, até 20 tentativas) e é enviado assim que o fbq aparecer.
 *
 * Mapa do funil:
 *   ViewContent / view_item           → página de detalhe de produto/combo
 *   AddToCart / add_to_cart           → botão "Adicionar" do carrinho
 *   InitiateCheckout / begin_checkout → abertura do checkout com itens
 *   Purchase / purchase               → página de sucesso (1x por pedido)
 *   Lead / generate_lead              → encomenda enviada (semanal e empório)
 */

type Fbq = (...args: unknown[]) => void;

type WindowWithTags = Window & {
  fbq?: Fbq;
  dataLayer?: unknown[];
};

function win(): WindowWithTags | null {
  return typeof window === "undefined" ? null : (window as WindowWithTags);
}

/** Push no formato gtag — precisa ser Arguments, não array (gtag.js ignora arrays). */
function gtagPush(..._args: unknown[]) {
  const w = win();
  if (!w) return;
  w.dataLayer = w.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  w.dataLayer.push(arguments);
}

const fbqPending: unknown[][] = [];
let fbqRetryTimer: ReturnType<typeof setInterval> | null = null;
let fbqRetries = 0;

function fbqCall(...args: unknown[]) {
  const w = win();
  if (!w) return;
  if (typeof w.fbq === "function") {
    w.fbq(...args);
    return;
  }
  fbqPending.push(args);
  if (fbqRetryTimer) return;
  fbqRetryTimer = setInterval(() => {
    const ww = win();
    fbqRetries += 1;
    if (ww && typeof ww.fbq === "function") {
      while (fbqPending.length > 0) ww.fbq(...(fbqPending.shift() as unknown[]));
    }
    if ((ww && typeof ww.fbq === "function") || fbqRetries >= 20) {
      clearInterval(fbqRetryTimer as ReturnType<typeof setInterval>);
      fbqRetryTimer = null;
      fbqRetries = 0;
      fbqPending.length = 0;
    }
  }, 500);
}

export type TrackedItem = {
  id: string;
  name: string;
  price: number;
  quantity?: number;
};

function ga4Items(items: TrackedItem[]) {
  return items.map((i) => ({
    item_id: i.id,
    item_name: i.name,
    price: i.price,
    quantity: i.quantity ?? 1,
  }));
}

export function trackViewContent(item: TrackedItem) {
  fbqCall("track", "ViewContent", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    value: item.price,
    currency: "BRL",
  });
  gtagPush("event", "view_item", {
    currency: "BRL",
    value: item.price,
    items: ga4Items([item]),
  });
}

export function trackAddToCart(item: TrackedItem) {
  const qty = item.quantity ?? 1;
  fbqCall("track", "AddToCart", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    value: item.price * qty,
    currency: "BRL",
  });
  gtagPush("event", "add_to_cart", {
    currency: "BRL",
    value: item.price * qty,
    items: ga4Items([item]),
  });
}

export function trackBeginCheckout(items: TrackedItem[], value: number) {
  fbqCall("track", "InitiateCheckout", {
    content_ids: items.map((i) => i.id),
    content_type: "product",
    num_items: items.reduce((acc, i) => acc + (i.quantity ?? 1), 0),
    value,
    currency: "BRL",
  });
  gtagPush("event", "begin_checkout", {
    currency: "BRL",
    value,
    items: ga4Items(items),
  });
}

/**
 * Compra concluída — deduplica por pedido via localStorage: a página de
 * sucesso pode ser recarregada/revisitada e o evento só pode contar 1x.
 * O eventID no Pixel permite dedup futura com a API de Conversões.
 */
export function trackPurchase(orderId: string, value: number) {
  const key = `casaroxa.tracked.purchase.${orderId}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    /* sem localStorage, dispara mesmo assim */
  }
  fbqCall(
    "track",
    "Purchase",
    { value, currency: "BRL" },
    { eventID: `purchase-${orderId}` },
  );
  gtagPush("event", "purchase", {
    transaction_id: orderId,
    currency: "BRL",
    value,
  });
}

/**
 * Encomenda enviada (vira venda só depois da aprovação — por isso Lead).
 * orderRequestId gera o eventID `lead-<id>`, o mesmo que o servidor manda
 * via API de Conversões — o Meta deduplica os dois.
 */
export function trackLead(
  label: "encomenda" | "encomenda_emporio",
  value: number,
  orderRequestId?: string,
) {
  fbqCall(
    "track",
    "Lead",
    {
      content_name: label,
      value,
      currency: "BRL",
    },
    ...(orderRequestId ? [{ eventID: `lead-${orderRequestId}` }] : []),
  );
  gtagPush("event", "generate_lead", {
    currency: "BRL",
    value,
    lead_source: label,
  });
}
