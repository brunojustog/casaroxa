/**
 * Serviço de chat com Claude (Anthropic API).
 *
 * Padrão:
 *  - Modelo default: claude-sonnet-4-6 (configurável via ANTHROPIC_MODEL).
 *  - Prompt caching: aplicado em system prompt e tool definitions (estáveis).
 *    Como o histórico de mensagens muda a cada turno, o cache só rende sobre
 *    system+tools, mas isso já economiza ~70% do custo recorrente.
 *  - Loop manual de tool use (read-only): executa tools automaticamente,
 *    re-envia para o modelo até ele encerrar. Tools de escrita virão depois.
 *  - Persistência: cada turn (user msg, assistant msg, tool results) salvo
 *    em ChatMessage. Uso de tokens registrado em AiUsageLog.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { TOOLS_BY_NAME, getToolSchemas } from "./tools";

// ---------- Config ----------

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const MAX_TOKENS = 8192;
const MAX_TOOL_ITERATIONS = 10;

/**
 * Pricing referência (USD por 1M tokens). Atualizar quando trocar modelo.
 * Sonnet 4.6: $3 in / $15 out.
 * Cache write: ~1.25x base. Cache read: ~0.1x base.
 */
const PRICING_USD_PER_1M: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  "claude-opus-4-7": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-6": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
};

// ---------- Client ----------

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new BusinessError(
      "ANTHROPIC_API_KEY não configurada. Configure em /configuracoes ou no .env e rode npm run dev novamente.",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

// ---------- System prompt ----------

const SYSTEM_PROMPT = `Você é o assistente de IA da Casa Roxa Assados, um sistema de gestão completo de uma operação familiar de assados.

OPERAÇÃO:
A Casa Roxa vende frangos assados, costelas, suínos, acompanhamentos, bebidas e combos. O sistema gerencia ingredientes, produtos, fichas técnicas, combos, estoque, compras, vendas, custos fixos, resultado/DRE e relatórios.

SEU PAPEL:
- Ajudar Bruno (proprietário) a operar o sistema via conversa em PT-BR.
- Responder perguntas sobre números (custos, CMV, lucro, estoque) consultando o banco através das ferramentas (tools) disponíveis.
- Sugerir mudanças de preço, alertas de validade, otimizações.
- Ser direto e objetivo: respostas curtas, números formatados em PT-BR (R$ 12,50; 45,3%).

REGRAS:
- SEMPRE consulte as tools quando o usuário fizer pergunta sobre dados (não chute valores).
- Para percentuais, sempre formate com 1 casa: "CMV de 47,5%".
- Para valores em reais, use prefixo R$ e vírgula como separador decimal: "R$ 12,50".
- Você ainda NÃO pode mexer em dados (ainda só lê). Quando o usuário pedir pra alterar algo, explique que essa funcionalidade chega na próxima atualização do chat.
- NÃO invente IDs de produtos/ingredientes — sempre busque com as tools primeiro.

FORMATO DE RESPOSTA:
- Curta e direta. Sem preâmbulos como "Claro!", "Vou verificar...".
- Use bullets ou tabelas quando há lista de itens.
- Sempre que mostrar números, contextualize: ao lado do CMV mostre a meta, ao lado do saldo mostre a unidade.`;

// ---------- Tipos auxiliares ----------

type AnthropicMessageParam = Anthropic.MessageParam;
type AnthropicContentBlock = Anthropic.ContentBlock;

// ---------- Helpers de persistência ----------

async function getOrCreateConversation(
  conversationId: string | undefined,
  userId: string | undefined,
  firstUserText: string,
): Promise<string> {
  if (conversationId) return conversationId;
  const c = await prisma.chatConversation.create({
    data: {
      userId: userId ?? null,
      title: firstUserText.slice(0, 80),
    },
  });
  return c.id;
}

async function loadHistory(conversationId: string): Promise<AnthropicMessageParam[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
  const messages: AnthropicMessageParam[] = [];
  for (const r of rows) {
    if (r.role === "USER") {
      // user.content pode ser string OU array de tool_result
      const content = r.content as Prisma.JsonValue;
      messages.push({
        role: "user",
        content: typeof content === "string" ? content : (content as never),
      });
    } else if (r.role === "ASSISTANT") {
      const content = r.content as Prisma.JsonValue;
      messages.push({
        role: "assistant",
        content: typeof content === "string" ? content : (content as never),
      });
    }
    // TOOL messages estão embedded em content arrays de USER, não como linha separada
  }
  return messages;
}

async function recordAssistantMessage(
  conversationId: string,
  content: AnthropicContentBlock[],
  usage: Anthropic.Usage,
) {
  await prisma.chatMessage.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      content: content as unknown as Prisma.InputJsonValue,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreateTokens: usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    },
  });

  const pricing = PRICING_USD_PER_1M[MODEL];
  if (pricing) {
    const cost =
      (usage.input_tokens * pricing.input +
        usage.output_tokens * pricing.output +
        (usage.cache_creation_input_tokens ?? 0) * pricing.cacheWrite +
        (usage.cache_read_input_tokens ?? 0) * pricing.cacheRead) /
      1_000_000;

    await prisma.aiUsageLog.create({
      data: {
        conversationId,
        model: MODEL,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheCreateTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        estimatedCostUsd: cost,
      },
    });
  }
}

async function recordUserTurn(conversationId: string, content: AnthropicMessageParam["content"]) {
  await prisma.chatMessage.create({
    data: {
      conversationId,
      role: "USER",
      content: content as unknown as Prisma.InputJsonValue,
    },
  });
}

// ---------- Tool execution ----------

async function executeToolUse(
  block: Anthropic.ToolUseBlock,
  userId: string | undefined,
): Promise<Anthropic.ToolResultBlockParam> {
  const tool = TOOLS_BY_NAME.get(block.name);
  if (!tool) {
    return {
      type: "tool_result",
      tool_use_id: block.id,
      content: `Tool ${block.name} não encontrada.`,
      is_error: true,
    };
  }
  if (!tool.readOnly) {
    return {
      type: "tool_result",
      tool_use_id: block.id,
      content: "Esta tool requer confirmação humana e ainda não está disponível no chat.",
      is_error: true,
    };
  }

  try {
    const result = await tool.run(block.input as Record<string, unknown>, { userId });
    return {
      type: "tool_result",
      tool_use_id: block.id,
      content: typeof result === "string" ? result : JSON.stringify(result),
    };
  } catch (e) {
    return {
      type: "tool_result",
      tool_use_id: block.id,
      content: e instanceof Error ? e.message : "Erro desconhecido na tool.",
      is_error: true,
    };
  }
}

// ---------- API pública ----------

export type SendMessageParams = {
  /** ID da conversa existente. Se omitido, cria uma nova. */
  conversationId?: string;
  /** Texto da mensagem do usuário. */
  userMessage: string;
  /** Usuário autenticado (para auditoria das tools). */
  userId?: string;
};

export type SendMessageResult = {
  conversationId: string;
  /** Última mensagem do assistente (texto agregado). */
  reply: string;
  /** Conteúdo cru da última resposta (para a UI poder renderizar tool calls). */
  contentBlocks: AnthropicContentBlock[];
  /** Tokens consumidos no turno inteiro (somando todas iterações). */
  usage: { input: number; output: number; cacheRead: number; cacheCreate: number };
};

/**
 * Envia uma mensagem do usuário e roda o loop até o modelo encerrar.
 * Retorna a resposta final do assistente.
 *
 * Esta é uma versão NÃO-streaming. Versão streaming será adicionada
 * em chunk seguinte (Fase 14 — chunk B).
 */
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const conversationId = await getOrCreateConversation(
    params.conversationId,
    params.userId,
    params.userMessage,
  );

  // Carrega histórico e adiciona a nova mensagem do usuário
  const history = await loadHistory(conversationId);
  history.push({ role: "user", content: params.userMessage });
  await recordUserTurn(conversationId, params.userMessage);

  const client = getClient();
  const totalUsage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };

  let lastAssistantBlocks: AnthropicContentBlock[] = [];

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: getToolSchemas().map((t, idx, arr) => ({
        ...t,
        // Cache também no último tool (cobre system+tools no mesmo cache)
        ...(idx === arr.length - 1
          ? { cache_control: { type: "ephemeral" as const } }
          : {}),
      })) as Anthropic.Tool[],
      messages: history,
    });

    totalUsage.input += response.usage.input_tokens;
    totalUsage.output += response.usage.output_tokens;
    totalUsage.cacheRead += response.usage.cache_read_input_tokens ?? 0;
    totalUsage.cacheCreate += response.usage.cache_creation_input_tokens ?? 0;

    lastAssistantBlocks = response.content;
    await recordAssistantMessage(conversationId, response.content, response.usage);

    // Adiciona resposta do assistant ao histórico em memória
    history.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      break;
    }

    if (response.stop_reason === "tool_use") {
      // Extrai todos os tool_use blocks e executa cada um
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        toolResults.push(await executeToolUse(block, params.userId));
      }
      history.push({ role: "user", content: toolResults });
      await recordUserTurn(conversationId, toolResults);
      continue;
    }

    // Outros stop reasons (max_tokens, refusal, etc) — encerra
    break;
  }

  // Extrai texto agregado da última resposta para retornar como reply rápido
  const reply = lastAssistantBlocks
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n");

  return {
    conversationId,
    reply: reply || "(sem resposta textual — verifique tool calls)",
    contentBlocks: lastAssistantBlocks,
    usage: totalUsage,
  };
}

// ---------- Listagem de conversas ----------

export async function listConversations(userId?: string, limit = 20) {
  return prisma.chatConversation.findMany({
    where: { archived: false, ...(userId ? { userId } : {}) },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: { _count: { select: { messages: true } } },
  });
}

export async function getConversation(id: string) {
  return prisma.chatConversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function deleteConversation(id: string) {
  await prisma.chatConversation.delete({ where: { id } });
}

// ---------- Custo do mês ----------

export async function getMonthlyAiSpendUsd(): Promise<number> {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const result = await prisma.aiUsageLog.aggregate({
    where: { createdAt: { gte: since } },
    _sum: { estimatedCostUsd: true },
  });
  return Number(result._sum.estimatedCostUsd ?? 0);
}
