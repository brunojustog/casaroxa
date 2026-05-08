/**
 * Geração de descrições comerciais via Anthropic API.
 *
 * Diferente do chat (que usa tools e mantém histórico), aqui é uma
 * chamada simples one-shot: monta contexto do produto/combo, manda para
 * o Claude, recebe texto. Cache de prompt no system message.
 */
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/enums";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new BusinessError(
      "ANTHROPIC_API_KEY não configurada. Configure no .env e reinicie o dev server.",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

const SYSTEM_PROMPT = `Você é o copywriter da Casa Roxa Assados, restaurante familiar especializado em frangos assados, costelas e suínos.

Sua tarefa: escrever descrições curtas para o cardápio online.

REGRAS DE ESTILO:
- 1 ou 2 frases. Máximo 30 palavras.
- Tom acolhedor, sem clichês como "delicioso", "irresistível", "saboroso", "imperdível".
- Linguagem brasileira natural e direta. Pode usar regionalismos sutis.
- Mencione 1-2 ingredientes ou características reais (textura, ponto, acompanhamento).
- Não use exclamação. Não use emojis.
- Sem "Experimente", "Venha provar", "Você vai amar".
- Não cite preço, peso, validade ou marca registrada.

FORMATO DE SAÍDA:
- Apenas o texto da descrição. Sem aspas, sem prefixo, sem explicação.`;

export type GenerateDescriptionInput = {
  kind: "PRODUTO" | "COMBO";
  id: string;
};

export async function generateDescription(
  input: GenerateDescriptionInput,
): Promise<string> {
  const context = await loadContext(input);
  const userPrompt = buildUserPrompt(context);

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new BusinessError("A IA não retornou texto. Tente novamente.");
  }

  // Limpa: remove aspas, prefixos e espaços extras
  return textBlock.text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(Descrição:|Texto:)\s*/i, "")
    .trim();
}

// ---------- Contexto ----------

type Context = {
  kind: "PRODUTO" | "COMBO";
  name: string;
  category: string;
  portionLabel: string | null;
  /** Ingredientes da Recipe interna (produtos) ou produtos do combo. */
  components: string[];
  /** Texto livre que Bruno já escreveu como ingredients pro cliente. */
  ingredientsHint: string | null;
};

async function loadContext(input: GenerateDescriptionInput): Promise<Context> {
  if (input.kind === "PRODUTO") {
    const product = await prisma.product.findUnique({
      where: { id: input.id },
      include: {
        recipe: {
          include: {
            items: {
              include: { ingredient: { select: { name: true } } },
              orderBy: { totalCost: "desc" },
            },
          },
        },
      },
    });
    if (!product) throw new BusinessError("Produto não encontrado.");
    return {
      kind: "PRODUTO",
      name: product.name,
      category: PRODUCT_CATEGORY_LABEL[product.category],
      portionLabel: product.portionLabel,
      components:
        product.recipe?.items
          .slice(0, 8)
          .map((it) => it.ingredient.name) ?? [],
      ingredientsHint: product.ingredientsPublic,
    };
  }

  const combo = await prisma.combo.findUnique({
    where: { id: input.id },
    include: {
      items: {
        include: { product: { select: { name: true } } },
        orderBy: { totalCost: "desc" },
      },
    },
  });
  if (!combo) throw new BusinessError("Combo não encontrado.");
  return {
    kind: "COMBO",
    name: combo.name,
    category: PRODUCT_CATEGORY_LABEL[combo.category],
    portionLabel: null,
    components: combo.items.slice(0, 6).map((it) => it.product.name),
    ingredientsHint: combo.ingredientsPublic,
  };
}

function buildUserPrompt(c: Context): string {
  const lines: string[] = [];
  lines.push(
    c.kind === "PRODUTO"
      ? `Escreva a descrição do produto:`
      : `Escreva a descrição do combo:`,
  );
  lines.push(`Nome: ${c.name}`);
  lines.push(`Categoria: ${c.category}`);
  if (c.portionLabel) lines.push(`Porção: ${c.portionLabel}`);
  if (c.components.length > 0) {
    lines.push(
      c.kind === "PRODUTO"
        ? `Ingredientes principais: ${c.components.join(", ")}`
        : `Itens do combo: ${c.components.join(", ")}`,
    );
  }
  if (c.ingredientsHint) {
    lines.push(`Cliente já vê estes ingredientes no cardápio: ${c.ingredientsHint}`);
  }
  return lines.join("\n");
}
