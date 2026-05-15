# Casa Roxa Gestão — Documento de Produto

> Versão 2.0 — Maio/2026. Atualizado após maratona de entrega das Sprints 2–9.
> Pré-launch (~30 dias até o go-live).

## 1. O que é

**Casa Roxa Gestão** é o sistema operacional completo da Casa Roxa Assados — restaurante familiar especializado em assados (frango, costela, suínos). Combina:

- **Cardápio público online** (`casaroxa.com.br`) — onde o cliente vê o menu, monta pedido, paga, encomenda, participa de sorteio, avalia.
- **Painel administrativo** (`gestao.casaroxa.com.br`) — onde a operação gerencia tudo: pedidos, estoque, cardápio, encomendas, pré-vendas, sorteios, marketing, fidelidade, NPS, finanças.

É um software **proprietário, single-tenant** hoje. A arquitetura é compatível com extração SaaS no futuro (não amarrado a "assados"), mas isso fica explicitamente fora do escopo até o go-live.

---

## 2. Atores

| Ator | Onde | Permissões |
|---|---|---|
| **Cliente final** | Site público, WhatsApp | Cardápio, pedido, pagamento, encomenda, pré-venda, sorteio, NPS, "meus pedidos" via OTP |
| **Operador** | Painel admin (perfil OPERADOR) | Atender pedidos, KDS, estoque, inventário, clientes, assistente IA |
| **Administrador (Bruno)** | Painel admin (perfil ADMIN) | Tudo + cadastros, finanças, campanhas, NPS, IA com aprovação, configurações |

Permissão é checada no middleware (RBAC) e novamente em cada server action (defesa em profundidade).

---

## 3. Mapa de Capacidades

### 🍽️ Cardápio digital
- Catálogo com fotos, preços, categorias (Frango, Costela, Suínos, Acompanhamentos, Extras, Bebidas, Combos)
- **Combos exibidos primeiro** (orientação a ticket)
- **Badge "🔥 Mais pedido"** nos top 3 vendidos nos últimos 30d (automático, sem configurar)
- **Badge "Economize R$ X"** quando o preço do combo é menor que a soma dos itens individuais
- **Header com atalhos:** Início, Cardápio, Encomendar, Meus pedidos, Carrinho, WhatsApp
- **Banner de pré-venda ativa** linkando pra `/pre-venda` quando há evento aberto
- Ficha pública por item (descrição, ingredientes derivados da receita, galeria, vídeo YouTube)
- SEO + JSON-LD pra Google Restaurant

### 🛒 Pedido & Checkout (`/checkout`)
- Carrinho persistente em `localStorage`
- Identificação leve via **OTP no WhatsApp** (sem senha)
- Endereço com **dupla confirmação** se carregado do cadastro (banner amarelo "Está pedindo de outro lugar HOJE?")
- Cupom de desconto (% ou R$ fixo, com min order, validUntil, maxUses)
- **Upsells inline:** sugere acompanhamento/bebida via regra de categoria complementar
- Pagamento online (Asaas PIX/cartão) **ou** combinar pelo WhatsApp
- Rastreamento público em `/pedido/[id]` (Recebido → Confirmado → Preparando → Pronto → Saiu pra entrega → Entregue)
- Botão "**Pedir novamente**" na tracking e em `/meus-pedidos` — refaz o carrinho com os mesmos itens, filtra indisponíveis

### 📦 Pré-venda fim de semana (`/pre-venda`)
- Admin cria evento (`SalesEvent`) com data, janela de inscrições, produtos com limite (`SalesEventProduct`) e janelas de retirada/entrega com capacidade (`SalesEventWindow`)
- Cliente reserva durante a semana → produção planejada no dia
- **Reservas expiram** se Sale não finaliza em N minutos (`reservationExpiresAt`)
- Apenas 1 evento OPEN por vez (constraint no service)
- Botão "**Duplicar +7 dias**" pra recorrência semanal sem fricção
- Cron `*/5 * * * *` libera reservas expiradas

### 🎂 Encomenda (`/encomenda`)
- Cliente pede pra data/hora **futura** (não é hoje) — separado do checkout normal
- Anteced. mínima configurável (default 48h)
- Items agrupados por categoria (Combos primeiro)
- Admin aprova/recusa no painel; aprovação gera Sale ABERTA vinculada
- **Sinal opcional** com link Asaas PIX automático: cliente pode pagar **dentro da tracking** (QR + copia-cola inline, sem redirect), polling 5s atualiza pra "pago"
- Cliente sem CPF cadastrado preenche na hora — fluxo self-service
- WhatsApp 4 momentos: recebida, aprovada, recusada (com motivo), pronta

### 🏭 Planejamento de produção (`/producao`)
- Seletor de data (default: próximo sábado)
- **Lista de produção** agregada a partir de pré-venda + encomenda (Sales avulsas ficam no KDS)
- **Lista de compras** consolidada por ingrediente via fichas técnicas — explode combos via ComboItem → Recipe → Ingredient
- Mostra unidade, quantidade total e custo estimado por linha
- Print stylesheet pra levar pro mercado/açougue

### 💳 Pagamentos online (Asaas)
- PIX com QR + copia-cola gerados na hora
- Cartão de crédito em popup centralizado (PCI fica com Asaas)
- Webhook automático: paga → conclui pedido → WhatsApp ao cliente
- **Polimorfismo:** OnlinePayment vincula a Sale, RaffleEntry ou OrderRequest (sinal)
- Validação CPF/CNPJ por dígito verificador antes de criar charge
- Cliente identifica CPF inline se ainda não tem (`POST /api/public/order-request/[id]/pay`)

### 🍳 Operação (admin) + KDS
- Lista de pedidos do dia com filtros (`/vendas`)
- Mudança de status na tela do pedido
- **KDS `/cozinha`** — Kanban polling 5s mostrando fila em tempo real
- Edição/cancelamento de Sale com reversão de estoque
- WhatsApp automático configurável em cada transição

### 🛒 Carrinho abandonado
- Capturado quando cliente preenche telefone válido + tem itens (debounce 3s no checkout)
- Idempotente por phone — 1 cart "aberto" por número
- Cron `*/15 * * * *` envia WhatsApp de recuperação pra carts > 30 min (configurável)
- Marcado como RECOVERED automaticamente quando cliente volta e finaliza
- `/carrinhos-abandonados` admin com 4 KPIs: aguardando, avisados, recuperados, receita recuperada

### 📦 Estoque & Compras
- Ingredientes com unidade, custo unitário, embalagem, fornecedor, estoque mínimo
- Receitas (ficha técnica) com cascata automática de custos
- Cadeia: Ingredient.unitCost → RecipeItem.totalCost → Recipe.totalCost → Product.totalCost → ComboItem.totalCost → Combo.totalCost
- Compra (`Purchase`) com items, status RASCUNHO/CONFIRMADA/CANCELADA
- **Importação de NFe XML** (`fast-xml-parser`) com matching:
  - 1º: consulta `IngredientAlias` (memória de matches manuais anteriores)
  - 2º: fuzzy match Jaccard (threshold 0.5)
  - Match manual no preview → salva alias automaticamente pra próxima vez
- **Preview de impacto antes de confirmar:** mostra qual ingrediente muda, % de variação, produtos afetados via Recipe, novo CMV vs target, sugestão de novo preço de venda se estourar
- Inventários (contagem cíclica) com fechamento gerando ajustes de estoque
- Alertas de estoque mínimo

### 🎟️ Rifas / Sorteios
- Pool fechado de números (1..N)
- Gratuita (1 cliente = 1 número) ou paga (PIX via Asaas)
- Cliente escolhe número numa grade visual
- Múltiplos prêmios por rifa (sorteio iterativo)
- Animação de roleta no momento do sorteio (admin)
- Comprovante público com QR
- "Indique e ganhe" — cliente compartilha link único, indicado se inscreve, indicador ganha número bônus

### 💜 Fidelidade & CRM
- Cadastro automático do cliente no checkout (upsert por phone normalizado)
- Cartão fidelidade: 1 pt/R$ → 100 pts vira cupom R$ 10
- Aniversariantes: cupom automático por WhatsApp no dia
- Histórico de pedidos por cliente em `/clientes/[id]` e em `/meus-pedidos`
- `Customer.marketingOptIn` (default true) — opt-out futuro filtra campanhas

### 📣 Campanhas + 8 públicos fixos
- Admin cria `Campaign` com nome, mensagem (template com `{nome}` e `{cupom}`), audiência fixa, cupom opcional gerado automaticamente
- **8 audiências pré-implementadas:**
  - Aniversariantes do mês
  - Inativos 30d
  - Recorrentes (3+ pedidos)
  - Alto ticket (avg > `Settings.targetAverageTicket`)
  - Comprou frango
  - Comprou costela
  - **Detratores 30d (NPS)** — recuperar
  - **Promotores 30d (NPS)** — premiar/indicar
- Preview de audiência ao vivo no form (count + sample)
- Disparo manual com confirmação dupla
- Rate limit 10s entre mensagens (anti-ban WhatsApp)
- Status DRAFT → DISPATCHING → SENT, com `CampaignDelivery` rastreando SENT/FAILED/SKIPPED por cliente
- **Atribuição automática de vendas** via cupom: `CampaignOrderAttribution` é criada na transação do checkout quando o cupom é o da campanha
- KPIs no detalhe: audiência, enviadas, vendas atribuídas, receita atribuída

### ⭐ NPS pós-entrega
- Admin clica "Enviar avaliação" em uma Sale entregue → gera `npsToken` único e dispara WhatsApp com link `/avaliacao/[token]`
- Cliente abre, escolhe 0–10 (botões coloridos: vermelho 0-6, amarelo 7-8, verde 9-10) + comentário opcional
- Categoria automática: DETRACTOR / PASSIVE / PROMOTER
- Página de obrigado adapta a mensagem por categoria
- `/avaliacoes` admin com NPS clássico calculado + lista filtrável
- Audiências NPS feedam o motor de campanhas (recuperação / indicação)

### 📱 WhatsApp (wuzapi self-hosted)
- QR Code de conexão no painel
- **11 toggles individuais** + master switch:
  - Pedido confirmado / pronto / saiu pra entrega
  - Aniversário, resgate fidelidade, pagamento recebido
  - Encomenda recebida / aprovada / recusada / pronta
  - Pedido de avaliação (NPS)
  - Carrinho abandonado
- Log completo (`WhatsAppMessageLog`) com status, erro, externalId
- Rate limit em campanhas

### 🤖 Chat IA (Anthropic Claude)
- Operador conversa em linguagem natural
- Read-only por padrão (consulta vendas, relatórios, listas)
- **Tokens + custo trackeados** em `AiUsageLog` por chamada
- Atende ADMIN e OPERADOR (com escopo restrito por role)

### ✋ IA com aprovação humana (`/aprovacoes-ia`)
- Motor novo: IA propõe ações de **escrita** que ficam PENDING aguardando admin
- 4 kinds suportados:
  - `CREATE_COUPON` — cria Coupon
  - `UPDATE_PRODUCT_PRICE` — ajusta `Product.salePrice` com price history
  - `SEND_WHATSAPP_CUSTOMER` — wuzapi pra 1 cliente
  - `DISPATCH_CAMPAIGN` — dispara Campaign DRAFT existente
- TTL 24h → vira EXPIRED automaticamente (cron horário)
- Cada proposta tem summary, reasoning, payload JSON validado por Zod
- Admin vê em fila, expande payload, aprova (executa imediato) ou rejeita
- Status flow: PENDING → APPROVED → EXECUTED / FAILED, ou PENDING → REJECTED / EXPIRED
- **Tools do chat IA que chamam `proposeAction` ainda não foram conectadas** — motor pronto, integração fica pra próxima rodada

### 📊 Analytics & Relatórios
- Dashboard com KPIs (faturamento, ticket médio, pedidos por dia, top produtos)
- Simulador "e se" (mudar margem, escala, projetar receita)
- DRE / Resultado / Cenários
- Custos fixos cadastrados
- Relatórios exportáveis CSV/PDF
- Push notifications (web push, VAPID) — admin recebe quando entra pedido novo

---

## 4. Diferenciais de posicionamento

| Diferencial | Por quê importa |
|---|---|
| OTP no WhatsApp (sem senha) | Conversão alta; cliente não cria conta |
| Cardápio próprio (não iFood) | 0 comissão, controle de marca, dados do cliente |
| PIX direto via Asaas | Taxa baixa (~0,99%), recebe mesmo dia |
| WhatsApp self-hosted (wuzapi) | Sem custo por mensagem, sem API oficial |
| Rifa com escolha + indicação | Mecânica viral, gera leads |
| Estoque + CMV integrados | Custo real do prato, não estimativa |
| Pré-venda + encomenda | Produção planejada — frente perdida pelo iFood |
| NPS com loop de ação | Detrator vira campanha de recuperação direto |
| Carrinho abandonado | Recupera receita perdida sem trabalho manual |
| IA com aprovação humana | Velocidade da IA + responsabilidade do humano |

---

## 5. Stack

- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind 3
- **Backend:** Next Server Actions + Prisma 5
- **Banco:** Postgres 16 (Docker Compose dev, Docker Swarm prod)
- **Pagamento:** Asaas (PIX + cartão, webhook)
- **WhatsApp:** wuzapi self-hosted (whatsmeow)
- **IA:** Anthropic Claude (Opus 4.7) com tool use
- **Auth:** Auth.js v5 + Credentials (admin), OTP via WhatsApp (cliente público)
- **Push:** Web Push API + VAPID
- **Infra:** Docker Swarm + Portainer + Traefik (Hetzner)
- **CI/CD:** GitHub Actions → GHCR (ghcr.io/brunojustog/casa-roxa-gestao)
- **Backup:** Hetzner Storage Box BX11 (cron diário)
- **Monitoramento de disco:** script local com cleanup automático >72h (`/usr/local/bin/casaroxa-disk-cleanup.sh`)

### Crons em produção
| Schedule | Endpoint | Função |
|---|---|---|
| `*/5 * * * *` | `/api/cron/cleanup-reservations` | Libera reservas de pré-venda expiradas |
| `*/15 * * * *` | `/api/cron/recover-abandoned-carts` | WhatsApp pra carrinhos abandonados >30 min |
| `0 * * * *` | `/api/cron/expire-ai-actions` | Marca AiActionApproval PENDING >24h como EXPIRED |
| `30 3 * * *` | `casaroxa-disk-cleanup.sh` | Limpeza de imagens Docker antigas + alerta disco |

Todos protegidos por `CRON_TOKEN` no header `x-cron-token`.

---

## 6. O que dá pra medir

- Faturamento por dia/semana/mês
- Ticket médio e por canal (LOJA / SITE / WHATSAPP / IFOOD / OUTRO)
- Conversão visita → pedido
- Cliente novo vs recorrente
- CMV real por produto, combo e categoria
- Margem por categoria com defaultCmv configurável
- Cupons usados, taxa de redenção
- Pontos de fidelidade emitidos vs resgatados
- Inscrições em sorteio + indicações que viraram inscrição
- **NPS** (% promotores − % detratores) + breakdown por categoria
- **Atribuição de vendas a campanhas** (via cupom)
- **Taxa de recuperação de carrinho** (RECOVERED / total)
- **Encomendas:** count por status, valor médio, sinal pago vs combinado
- **Pré-venda:** disponibilidade restante por produto/janela
- Tokens + custo das mensagens IA (`AiUsageLog`)
- Lead time da cozinha (KDS → entregue)

---

## 7. Gaps conhecidos (pós-roadmap)

### Curtos (antes do go-live)
- **Conectar tools do chat IA ao motor `proposeAction`** — Sprint 9 fase B; motor pronto, falta wiring
- **Semana de testes em família** (planejada, ~1 semana antes do go-live)
- **Validar opt-in WhatsApp** — Casa Roxa hoje assume opt-in implícito; revisar termo de uso e formalizar
- **Templates oficiais Meta** se um dia migrarmos pra Cloud API (campanhas em massa)

### Médios (após go-live, baseado em uso real)
- Reservas de mesa (consumo presencial)
- Cashback (alternativa ao cartão fidelidade)
- Comissão por vendedor/atendente
- Devolução / estorno parcial
- Programa de embaixador (cliente fiel ganha % de quem indicar)
- Push notification de promoções segmentadas (infra existe, falta UI)
- Loja de assinaturas (combo mensal via PIX recorrente)
- Multi-loja (preparar arquitetura SaaS)

### Estratégicos
- Extração SaaS Simplifica (`BusinessProfile` multi-tenant)
- Cardápio com vídeo curto TikTok-style por item
- Integração com iFood (canal complementar pra picos)

---

## 8. Riscos a discutir

1. **Single-tenant ainda:** virar SaaS exige isolamento de dados, billing, onboarding. Decisão consciente — fazer só depois de Casa Roxa estar 100% operacional.
2. **wuzapi não-oficial:** WhatsApp pode banir o número em uso de spam. Transacionais (confirmação, pagamento) têm risco baixo; campanhas em massa têm risco alto. Mitigação: rate limit 10s, opt-in, limite de envio por dia (a configurar).
3. **Asaas em produção:** funcionando, taxas baixas (~0,99% PIX, ~3,99%+R$0,40 cartão). Sinal de encomenda usa o mesmo gateway.
4. **Sem testes automatizados de UI:** validação 100% por teste manual do Bruno + semana em família. Plano: introduzir Playwright depois do go-live.
5. **Dependência de cron:** 4 crons rodando no manager. Se cair, recuperação de carrinho, expiração de reservas e expiração de IA param. Monitorar.
6. **Disco do servidor:** problema histórico desta sessão (containerd encheu 73GB). Mitigado por cleanup diário; vale alarme externo se passar 80%.

---

## 9. Estado em produção (snapshot)

| Item | Valor |
|---|---|
| Image Docker | `ghcr.io/brunojustog/casa-roxa-gestao:latest` (manager Hetzner) |
| Migrations aplicadas | 23 (todas additivas) |
| Toggles WhatsApp | 11 individuais + master switch |
| Audiências de campanha | 8 fixas |
| Kinds de IA aprovável | 4 (cupom, preço, WhatsApp, campanha) |
| Domínio cliente | `casaroxa.com.br` (+ `www.`) |
| Domínio admin | `gestao.casaroxa.com.br` |
| Staging | `staging.casaroxa.com.br` / `staging-gestao.casaroxa.com.br` |

---

## 10. Operação e ciclo

- **Hoje (pré-launch):** Bruno desenvolve + testa manualmente. Banco zerado de transações; só catálogo + configurações persistem.
- **Próxima semana (planejada):** semana de testes intensivos com a família simulando todos os fluxos (pedido normal, encomenda, pré-venda, sorteio, NPS, recuperação de carrinho, campanha).
- **Go-live (~30 dias a partir de 2026-05-14):** abertura ao público.
- **Pós-launch:** iteração baseada em uso real, lista de melhorias do mundo real, conexão das tools do chat IA ao motor de aprovação.

---

## 11. Equipe

Desenvolvedor solo (Bruno) com apoio de IA (Claude Opus 4.7 em sessões estendidas). Cadência típica: 10–15 commits/dia em sessões de foco. Roadmap inteiro entregue em 1 dia (2026-05-14) — Sprints 2–9 das 9 planejadas.
