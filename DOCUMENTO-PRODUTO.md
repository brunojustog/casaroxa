# Casa Roxa Gestão — Documento de Produto

> Documento de apoio para discussão com equipe de produto e marketing.
> Maio/2026.

## 1. O que é

**Casa Roxa Gestão** é o sistema operacional completo da Casa Roxa Assados — um restaurante familiar especializado em assados (frango, costela, suínos). Combina:

- **Cardápio público online** (`casaroxa.com.br`) — onde o cliente vê o menu, monta pedido, paga.
- **Painel administrativo** (`gestao.casaroxa.com.br`) — onde a operação gerencia tudo: pedidos, estoque, cardápio, rifas, marketing, fidelidade.

É um software **proprietário, single-tenant** (só serve a Casa Roxa hoje, mas a arquitetura permite virar SaaS).

---

## 2. Atores (quem usa)

| Ator | Onde | Permissões |
|---|---|---|
| **Cliente final** | Site público, WhatsApp | Ver cardápio, fazer pedido, pagar, acompanhar entrega, participar de sorteios, ver histórico (Meus Pedidos), receber notificações |
| **Operador** | Painel admin | Atender pedidos, lançar estoque, gerar cupons, aprovar rifas |
| **Administrador (Bruno)** | Painel admin (acesso total) | Tudo + configurações, simulador, IA, integrações |

---

## 3. Mapa de Capacidades (10 módulos)

### 🍽️ Cardápio digital
- Catálogo com fotos, preços, categorias (Frango, Costela, Suínos, Acompanhamentos, Bebidas, Combos)
- **Combos** com ficha técnica (CMV calculado automaticamente)
- Banner promocional na home
- SEO + JSON-LD pra Google Restaurant

### 🛒 Pedido & Checkout
- Carrinho persistente (localStorage)
- Checkout com identificação leve via OTP no WhatsApp (sem senha)
- Endereço com **dupla confirmação** ("é o cadastrado?") — evita motoboy ir endereço errado
- Cupom de desconto (% ou R$ fixo)
- Pagamento **online** (Asaas — PIX ou cartão de crédito) **ou** combinar no WhatsApp
- Rastreamento público do pedido (Recebido → Preparando → Saiu pra entrega → Entregue)

### 💳 Pagamentos online (Asaas)
- PIX com QR code + copia-cola gerados na hora
- Cartão de crédito em **popup centralizado** (PCI fica com Asaas, sem dado de cartão no nosso servidor)
- Webhook automático: quando paga, conclui pedido + dispara WhatsApp de confirmação
- Validação de CPF/CNPJ por dígito verificador

### 📋 Operação (admin)
- Lista de pedidos do dia com filtros
- Mudança de status (avança pedido na esteira)
- WhatsApp automático em cada transição configurável
- Edição/cancelamento de pedido (volta o estoque)

### 📦 Estoque & Compras
- Cadastro de ingredientes com unidades + custo unitário
- Receitas (ficha técnica) com cascata automática de custos
- **Lançamento de NFe** via XML (parser + matching de produtos por similaridade)
- Estoque físico com **inventários** (contagem cíclica)
- Alertas de **estoque mínimo**
- Cascata de custos: quando preço do ingrediente muda → receita atualiza → produto atualiza → combo atualiza

### 🎟️ Rifas / Sorteios
- Rifa com **pool fechado de números** (1..N)
- **Gratuita** (1 cliente = 1 número, limite configurável) **ou paga** (R$ X por número, PIX)
- Cliente **escolhe** seu número numa grade visual (verde/cinza/selecionado)
- **Múltiplos prêmios por rifa** (ex: 4 ganhadores no Dia das Mães), sorteio iterativo do menor pro 1º lugar
- **Animação de roleta** no momento do sorteio (admin)
- **Comprovante público** com QR de validação
- **"Indique e ganhe"**: cliente compartilha link único, quando amigo se inscreve ele ganha 1 número bônus

### 💜 Fidelidade & CRM
- Cadastro automático do cliente no checkout
- **Cartão fidelidade**: 1 ponto por R$ 1 gasto → 100 pts vira cupom de R$ 10
- **Aniversariantes**: cupom automático enviado por WhatsApp no dia
- Histórico completo de pedidos do cliente
- Promoções automáticas por gatilho

### 📱 WhatsApp
- Integração com **wuzapi self-hosted** (sem custo por mensagem)
- QR Code de conexão no painel
- Toggles por evento: confirmado, pronto, saiu pra entrega, pagamento recebido, aniversário, resgate, sorteio
- Log de todas mensagens enviadas

### 🤖 Chat IA (Claude)
- Operador conversa em linguagem natural com o sistema
- Read-only por padrão; tools de escrita exigem aprovação
- Pode consultar relatórios, listar pedidos, criar cupons, sortear rifa, enviar WhatsApp
- Tokens + custo trackeados (`AiUsageLog`)

### 📊 Analytics & Relatórios
- Dashboard com KPIs (faturamento, ticket médio, pedidos por dia, top produtos)
- Simulador "e se" (mudar margem, escala, projetar receita)
- Relatórios exportáveis (CSV / PDF)
- Notificações push (web push, VAPID)

---

## 4. Diferenciais de posicionamento

| Diferencial | Por quê importa |
|---|---|
| **OTP no WhatsApp** (sem senha) | Conversão alta: cliente não cria conta, só recebe código |
| **Cardápio digital próprio** (não iFood) | 0 comissão, controle de marca, dados do cliente |
| **Pagamento online com PIX direto** | Custo de gateway baixo (Asaas), recebe no mesmo dia |
| **WhatsApp self-hosted** (wuzapi) | Sem custo por mensagem, sem depender de API oficial |
| **Rifa com escolha de número + indicação** | Mecânica viral, gera leads pra base de clientes |
| **Estoque integrado** | Vê custo real do prato, não estimativa |
| **Chat IA pro operador** | Operação rápida, menos cliques |

---

## 5. Stack (resumida)

- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind
- **Backend**: Next Server Actions + Prisma 5
- **Banco**: Postgres 16
- **Pagamento**: Asaas (PIX + cartão)
- **WhatsApp**: wuzapi (self-hosted, baseado em whatsmeow)
- **IA**: Anthropic Claude (com tool use)
- **Infra**: Docker Swarm + Portainer + Traefik (VPS própria)
- **CI/CD**: GitHub Actions → GHCR

---

## 6. O que dá pra medir (dados disponíveis)

- Faturamento por dia/semana/mês
- Ticket médio
- Conversão de visita pra pedido
- Cliente novo vs recorrente
- CMV real por produto/combo
- Margem por categoria
- Cupons usados, taxa de redenção
- Pontos de fidelidade emitidos vs resgatados
- Inscrições em sorteio, indicações que viraram inscrição
- Custo total das mensagens IA (Claude)
- Pedidos por canal (cardápio online vs combinado WhatsApp)
- Lead time da cozinha (entre confirmar e sair pra entrega)

---

## 7. Gaps conhecidos / oportunidades

### Curtos (fazer já)
- **Tela de cozinha (KDS)**: monitor mostrando fila de pedidos em tempo real
- **Comprovante de pedido** (espelho do que rifa já tem)
- **Cardápio sazonal** (data início/fim por produto): Páscoa, Mães, etc
- **Logout do cliente** no header público

### Médios
- **Reservas de mesa** (se for explorar consumo presencial)
- **Programa de cashback** (alternativa ao cartão fidelidade)
- **Comissão por vendedor/atendente**
- **Devolução / estorno parcial**
- **Multi-loja** (preparar arquitetura pra franquias)

### Estratégicos (alinhar com marketing)
- **Cardápio com vídeo curto** (TikTok-style, item por item)
- **Programa de embaixador**: cliente fiel vira "padrinho", ganha % de quem indicar (não só números de rifa)
- **Push notification** com promoções segmentadas (já tem infra, falta UI de campanha)
- **Carrinho abandonado** → WhatsApp recuperação
- **Reviews/avaliação** pós-entrega (NPS)
- **Eventos privados** (encomendas grandes)
- **Loja de assinaturas** (combo mensal recorrente via PIX automático)

---

## 8. Riscos a discutir

1. **Single-tenant**: arquitetura serve só Casa Roxa hoje. Virar SaaS exige isolamento de dados, billing, onboarding.
2. **wuzapi não-oficial**: WhatsApp pode banir o número se uso parecer spam. Mensagens transacionais (confirmação, pagamento) têm risco baixo; campanhas em massa têm risco alto.
3. **Asaas em produção**: já configurado, funcionando. Taxas: ~0,99% PIX, ~3,99% + R$ 0,40 cartão.
4. **Sem testes automatizados**: cada deploy é roleta — risco cresce conforme features acumulam.

---

## 9. Quem usa hoje

- Casa Roxa Assados — Lençóis Paulista/SP
- ~1 admin (Bruno) + N operadores
- Base de clientes: em construção (banco ainda novo, sem dados de produção significativos)

---

## 10. Quem desenvolve

Desenvolvedor solo (Bruno) com apoio de IA (Claude) em hora estendida. Cadência: ~10-15 commits/dia em sessões de feature foco.
