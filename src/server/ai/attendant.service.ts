/**
 * Atendente IA do WhatsApp — Fase 1 (responde e vende, sem escrever nada).
 *
 * Segurança em primeiro lugar:
 *  - NÃO usa as tools internas (que expõem custos/CMV e dados de clientes).
 *  - O contexto é PRÉ-MONTADO só com dados públicos: cardápio com preços de
 *    venda, pronta entrega com disponibilidade, horários, chave da cozinha,
 *    regras de entrega, sorteio ativo e links.
 *  - Handoff: cliente pedindo humano/reclamando → IA silencia a conversa e
 *    marca pro Bruno assumir. Admin pode devolver pra IA no painel.
 *  - Modo teste: responde só aos telefones da lista (Settings).
 *
 * Custo: modelo Haiku por padrão (ATTENDANT_MODEL pra trocar), system com
 * prompt caching — centavos por conversa, tudo em AiUsageLog.
 */
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { sendText } from "@/server/services/whatsapp.service";
import { getAllStockBalances } from "@/server/services/stock.service";

const MODEL = process.env.ATTENDANT_MODEL ?? "claude-haiku-4-5";
const MAX_TOKENS = 1024;
const HISTORY_LIMIT = 24;

const PRICING_USD_PER_1M: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
};

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  _client = new Anthropic({ apiKey });
  return _client;
}

// ---------- contexto vivo (dados públicos) ----------

function brl(v: unknown) {
  return `R$ ${Number(v ?? 0).toFixed(2).replace(".", ",")}`;
}

async function buildLiveContext(): Promise<string> {
  const [settings, products, raffles, balances] = await Promise.all([
    prisma.settings.findUniqueOrThrow({
      where: { id: 1 },
      select: {
        businessName: true,
        address: true,
        addressNeighborhood: true,
        openingHours: true,
        deliveryFeeNote: true,
        minimumOrderValue: true,
        cardapioClosed: true,
        cardapioClosedMessage: true,
      },
    }),
    prisma.product.findMany({
      where: { active: true, salePrice: { gt: 0 } },
      select: {
        name: true,
        category: true,
        salePrice: true,
        portionLabel: true,
        showInMenu: true,
        status: true,
        recipe: { select: { items: { take: 1, select: { ingredientId: true, unit: true } } } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.raffle.findMany({
      where: { status: "OPEN" },
      select: { id: true, name: true, drawAt: true, appOnly: true },
      take: 2,
    }),
    getAllStockBalances(),
  ]);

  const linhas: string[] = [];
  let catAtual = "";
  for (const p of products) {
    if (p.category !== catAtual) {
      catAtual = p.category;
      linhas.push(`\n[${catAtual}]`);
    }
    const item = p.recipe?.items[0];
    const byWeight =
      item?.unit === "KG" || (p.portionLabel ?? "").toLowerCase().includes("kg");
    // Disponibilidade: revenda (ficha 1:1) usa saldo real; produção própria
    // (cozinha) considera "sob demanda".
    let disp = "";
    if (item && (p.category === "EMPORIO" || p.category === "CONGELADOS" || p.category === "BEBIDAS")) {
      const saldo = balances.get(item.ingredientId) ?? 0;
      if (saldo <= 0.001) disp = " [ESGOTADO no momento]";
      else if (!byWeight && saldo <= 3) disp = ` [últimas ${Math.floor(saldo)} un]`;
    }
    if (p.status === "SOB_ENCOMENDA") disp += " [só por encomenda]";
    linhas.push(
      `- ${p.name}: ${brl(p.salePrice)}${byWeight ? "/kg" : p.portionLabel ? ` (${p.portionLabel})` : ""}${disp}`,
    );
  }

  const agora = new Date().toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  const sorteio = raffles[0]
    ? `SORTEIO ATIVO: "${raffles[0].name}"${raffles[0].drawAt ? ` — sorteio ${new Date(raffles[0].drawAt).toLocaleString("pt-BR", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}` : ""}. Link: https://casaroxa.com.br/sorteio/${raffles[0].id}${raffles[0].appOnly ? " (exclusivo pra quem instala o app)" : ""}. Em agosto tem sorteio todo domingo!`
    : "Nenhum sorteio ativo no momento.";

  return `AGORA: ${agora}

STATUS DA COZINHA (pedidos quentes pra agora): ${
    settings.cardapioClosed
      ? `FECHADA${settings.cardapioClosedMessage ? ` — "${settings.cardapioClosedMessage}"` : ""}. Encomendas e empório continuam abertos.`
      : "ABERTA — aceitando pedidos."
  }
HORÁRIOS: ${settings.openingHours ?? "consulte"}
ENDEREÇO: ${settings.address ?? ""} — ${settings.addressNeighborhood ?? ""}
ENTREGA: ${settings.deliveryFeeNote ?? "Retirada na loja ou entrega a combinar"}.${settings.minimumOrderValue ? ` Pedido mínimo ${brl(settings.minimumOrderValue)}.` : ""}
LENÇÓIS PAULISTA: entregamos no ponto de retirada aos domingos (pedidos pelo site).

${sorteio}

LINKS ÚTEIS:
- Cardápio e pedidos: https://casaroxa.com.br/cardapio
- Encomendas (cozinha, pra data marcada): https://casaroxa.com.br/encomenda
- Empório e congelados (pronta entrega + encomenda de viagem): https://casaroxa.com.br/emporio/encomenda
- Instalar o app (sorteios exclusivos!): https://casaroxa.com.br

PRODUTOS E PREÇOS (disponibilidade em tempo real):${linhas.join("\n")}`;
}

const PERSONA = `Você é a atendente virtual da Casa Roxa Assados & Empório, de Jaú/SP — um negócio familiar de frangos assados, costelas, suínos, congelados e empório mineiro.

TOM: caloroso, simpático e direto, como um bom atendimento de balcão do interior. PT-BR informal (mas educado), emojis com moderação (💜 🐔 é a nossa cara). Mensagens CURTAS — é WhatsApp, ninguém lê textão. Nunca use asteriscos duplos nem formatação de markdown além de *negrito simples* do WhatsApp.

REGRAS DE OURO:
1. Responda SÓ com base nos dados do contexto. Preço, disponibilidade e horário: use exatamente o que está lá. Se não souber, diga que vai confirmar com a equipe — NUNCA invente.
2. Venda com jeitinho: se a pessoa pede frango, sugira UM complemento que combine (farofa, maionese, arroz). Uma sugestão por conversa, sem insistir.
3. Se a cozinha estiver FECHADA, deixe claro e ofereça o caminho: encomenda pro fim de semana ou empório/congelados à pronta entrega.
4. Pedidos: orientar a fazer pelo site (links do contexto) — o pagamento online (PIX/cartão) é por lá. Você não registra pedidos por mensagem.
5. Divulgue o sorteio/app quando fizer sentido natural (ex.: cliente novo, ou perguntou de promoção).
6. NUNCA fale de custos internos, fornecedores, sistema ou qualquer assunto que não seja o atendimento da Casa Roxa. Se perguntarem algo fora disso (política, outros negócios, etc.), volte gentilmente pro atendimento.
7. HANDOFF: se o cliente pedir pra falar com uma pessoa, estiver bravo/reclamando, ou o assunto for delicado (erro em pedido pago, reembolso, reclamação de qualidade), responda APENAS com a palavra especial: [HUMANO]
   Nada além de [HUMANO] nessa resposta — o sistema chama a equipe e assume dali.`;

// ---------- núcleo ----------

function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, "");
  if (p.length === 10 || p.length === 11) p = `55${p}`;
  return p;
}

const HANDOFF_PATTERNS =
  /(falar|conversar)\s+com\s+(um\s+)?(atendente|humano|pessoa|alguem|alguém)|quero\s+(um\s+)?atendente|atendente\s+humano/i;

export type IncomingWaMessage = {
  phone: string;
  text: string;
  displayName?: string | null;
  isGroup?: boolean;
  fromMe?: boolean;
};

/**
 * Processa uma mensagem recebida no WhatsApp. Retorna o que aconteceu
 * (pra log do webhook) — nunca lança.
 */
export async function handleIncomingWaMessage(
  msg: IncomingWaMessage,
): Promise<{ action: string; reply?: string }> {
  try {
    if (msg.fromMe) return { action: "ignored_from_me" };
    if (msg.isGroup) return { action: "ignored_group" };
    const text = (msg.text ?? "").trim();
    if (!text) return { action: "ignored_empty" };
    if (text.length > 2000) return { action: "ignored_too_long" };

    const phone = normalizePhone(msg.phone);
    if (phone.length < 12) return { action: "ignored_bad_phone" };

    const settings = await prisma.settings.findUniqueOrThrow({
      where: { id: 1 },
      select: { aiAttendantEnabled: true, aiAttendantTestPhones: true },
    });
    if (!settings.aiAttendantEnabled) return { action: "disabled" };

    // Modo teste: só responde aos números autorizados.
    const testPhones = (settings.aiAttendantTestPhones ?? "")
      .split(/[,;\s]+/)
      .map((p) => p.replace(/\D/g, ""))
      .filter((p) => p.length >= 10);
    if (testPhones.length > 0 && !testPhones.some((p) => phone.endsWith(p) || p.endsWith(phone))) {
      return { action: "not_in_test_list" };
    }

    // Conversa (vincula Customer por telefone quando existir)
    const customer = await prisma.customer.findFirst({
      where: { phone: { endsWith: phone.slice(-10) } },
      select: { id: true, name: true },
    });
    const conv = await prisma.waConversation.upsert({
      where: { phone },
      create: {
        phone,
        displayName: msg.displayName ?? null,
        customerId: customer?.id ?? null,
      },
      update: {
        lastMessageAt: new Date(),
        displayName: msg.displayName ?? undefined,
        customerId: customer?.id ?? undefined,
      },
    });

    await prisma.waMessage.create({
      data: { conversationId: conv.id, role: "USER", content: text },
    });

    // Conversa entregue pra humano: IA fica quieta.
    if (conv.handedOff) return { action: "handed_off_silent" };

    // Atalho de handoff sem gastar token.
    if (HANDOFF_PATTERNS.test(text)) {
      return await doHandoff(conv.id, phone);
    }

    const client = getClient();
    if (!client) return { action: "no_api_key" };

    const [liveContext, history] = await Promise.all([
      buildLiveContext(),
      prisma.waMessage.findMany({
        where: { conversationId: conv.id, role: { in: ["USER", "ASSISTANT"] } },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      }),
    ]);

    const messages = history
      .reverse()
      .map((m) => ({
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));
    // Garante alternância válida começando em user (Anthropic exige).
    while (messages.length > 0 && messages[0].role !== "user") messages.shift();

    const clienteInfo = customer?.name
      ? `\n\nCLIENTE IDENTIFICADO: ${customer.name} (já é cliente cadastrado).`
      : "";

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: "text", text: PERSONA, cache_control: { type: "ephemeral" } },
        { type: "text", text: liveContext + clienteInfo },
      ],
      messages,
    });

    // Log de uso/custo
    const pricing = PRICING_USD_PER_1M[MODEL] ?? PRICING_USD_PER_1M["claude-haiku-4-5"];
    const u = response.usage;
    const cost =
      (u.input_tokens * pricing.input +
        u.output_tokens * pricing.output +
        (u.cache_creation_input_tokens ?? 0) * pricing.cacheWrite +
        (u.cache_read_input_tokens ?? 0) * pricing.cacheRead) /
      1_000_000;
    await prisma.aiUsageLog.create({
      data: {
        conversationId: `wa:${conv.id}`,
        model: MODEL,
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheCreateTokens: u.cache_creation_input_tokens ?? 0,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        estimatedCostUsd: cost.toFixed(6),
      },
    });

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!reply) return { action: "empty_reply" };

    if (reply.includes("[HUMANO]")) {
      return await doHandoff(conv.id, phone);
    }

    await prisma.waMessage.create({
      data: { conversationId: conv.id, role: "ASSISTANT", content: reply },
    });
    await sendText({
      phone,
      message: reply,
      event: "MANUAL",
      customerId: customer?.id ?? null,
      bypassToggles: true,
    });
    return { action: "replied", reply };
  } catch (e) {
    console.error("[attendant] erro:", e instanceof Error ? e.message : e);
    return { action: "error" };
  }
}

async function doHandoff(conversationId: string, phone: string) {
  await prisma.waConversation.update({
    where: { id: conversationId },
    data: { handedOff: true, handedOffAt: new Date() },
  });
  const aviso =
    "Já chamei alguém da equipe pra falar com você, um instante! 💜";
  await prisma.waMessage.create({
    data: { conversationId, role: "NOTE", content: "→ conversa entregue pra atendimento humano" },
  });
  await sendText({
    phone,
    message: aviso,
    event: "MANUAL",
    bypassToggles: true,
  });
  // Avisa o admin no WhatsApp dele (se configurado)
  const adminPhone = process.env.WA_ADMIN_PHONE;
  if (adminPhone) {
    await sendText({
      phone: adminPhone,
      message: `🔔 Atendimento humano solicitado no WhatsApp da loja!\nCliente: +${phone}\nResponda pelo WhatsApp da Casa Roxa — a IA já silenciou nessa conversa.`,
      event: "MANUAL",
      bypassToggles: true,
    });
  }
  return { action: "handed_off" };
}

// ---------- painel ----------

export async function listWaConversations(limit = 50) {
  return prisma.waConversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: limit,
    include: {
      customer: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 6 },
    },
  });
}

export async function setConversationHandoff(id: string, handedOff: boolean) {
  return prisma.waConversation.update({
    where: { id },
    data: { handedOff, handedOffAt: handedOff ? new Date() : null },
  });
}
