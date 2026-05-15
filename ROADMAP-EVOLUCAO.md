# Roadmap de Evolução — Casa Roxa Gestão → SaaS Simplifica

> Versão 2.0 — Maio/2026. Sprints 1–9 entregues; foco agora é **estabilização + go-live**.

## Resumo da tese

Não competir como "mais um cardápio digital". Posicionar como **plataforma de venda direta** com inteligência de margem, produção, recompra e marketing. Validar tudo na Casa Roxa primeiro; extrair pra SaaS Simplifica depois.

## Status das fases

| Fase | Objetivo | Status |
|---|---|---|
| 1. MVP operacional | Rodar delivery real sem planilha | ✅ Entregue |
| 2. Motor de crescimento | Provar recompra e campanhas | ✅ Entregue (campanhas + atribuição + NPS + carrinho abandonado) |
| 3. Inteligência operacional | IA ajuda decisões com aprovação | ✅ Motor entregue; tools no chat IA ficam pra fase B |
| 4. Extração SaaS | Multi-tenant, billing, onboarding | 🔒 Bloqueada até Casa Roxa estar operando estável |

## Sprints (status real)

| # | Entrega | Status |
|---|---|---|
| 1 | Estabilização operacional: KDS (polling 5s), comprovante de Sale, staging, backup/restore | ✅ Entregue |
| 2 | Pré-venda do fim de semana + disponibilidade por lote + janelas + reserva expirável | ✅ Entregue |
| 3 | Encomendas com data futura + sinal Asaas + QR PIX inline + WhatsApp 4 momentos + planejamento de produção (`/producao`) | ✅ Entregue (escopo expandiu além do roadmap original) |
| 4 | Meus Pedidos + botão "Pedir novamente" | ✅ Entregue |
| 5 | Campanhas simples + 6 públicos fixos + atribuição via cupom | ✅ Entregue |
| 6 | NPS pós-entrega + 2 audiências NPS (detratores/promotores) integradas com campanhas | ✅ Entregue |
| 7 | Carrinho abandonado + upsells + cardápio orientado a ticket (combos primeiro, badge "mais pedido", economia) | ✅ Entregue |
| 8 | `IngredientAlias` (memória de match NFe) + preview de impacto CMV + histórico de custo com sparkline | ✅ Entregue |
| 9 | `AiActionApproval` (motor: cupom, preço, WhatsApp, campanha) + UI `/aprovacoes-ia` + cron expiração 24h | ✅ Motor entregue, ⚠️ tools do chat IA não conectadas |

## P0 antes do go-live

1. **Conectar tools do chat IA ao motor `proposeAction`** — registrar 4 tools no Anthropic SDK que chamam `proposeAction` em vez de executar direto.
2. **Semana de testes em família** — Bruno + família simulando todos os fluxos.
3. **Revisar termos de uso** — formalizar opt-in WhatsApp pra campanhas.
4. **Documentar manual de uso end-user** (em andamento, nesta sprint de docs).

## Decisões revisadas (mantidas)

- **Sem multi-tenant agora** — `Settings` é parametrizado mas único.
- **Públicos fixos primeiro** — 8 audiências entregues, query builder fica pra Fase 4.
- **WhatsApp em campanha** com rate limit 10s + opt-in implícito (revisar termo).
- **KDS com polling 5s**, não WebSocket. Tá rodando bem.
- **`AiUsageLog` já existia** — só `AiActionApproval` foi entidade nova na Sprint 9.

## Módulos entregues (todos)

- ✅ Motor de Campanhas (`Campaign`, `CampaignDelivery`, `CampaignOrderAttribution`)
- ✅ Públicos Fixos (8 audiências como código, não tabela)
- ✅ Carrinho Abandonado (`AbandonedCart`)
- ✅ Pré-venda (`SalesEvent`, `SalesEventProduct`, `SalesEventWindow`)
- ✅ Encomendas (`OrderRequest`, `OrderRequestItem`)
- ✅ Planejamento de Produção (computed on-the-fly, sem persistir — entity `ProductionPlan` adiada como evolução)
- ✅ NPS / Avaliações (`CustomerReview`)
- ✅ Compras XML/NFe (`IngredientAlias`)
- ✅ IA com aprovação (`AiActionApproval`)

## Módulos adiados pra Fase 4 (SaaS)

- Multi-tenant (`BusinessProfile`, isolamento de dados, billing)
- Query builder de audiências dinâmicas (`Audience`, `AudienceRule`)
- `ProductionPlan` persistido com tasks marcáveis pela cozinha
- `InventoryLot` (rastreamento por lote em NFe)

## Critérios globais de aceite

| Critério | Status |
|---|---|
| Cliente faz pedido, paga, acompanha | ✅ |
| Admin opera cozinha em tempo real (KDS) | ✅ |
| Sistema planeja produção a partir de pedidos confirmados | ✅ |
| Custo/CMV/lucro visíveis por produto, combo, campanha | ✅ |
| Campanhas rastreáveis a pedidos (atribuição) | ✅ |
| Histórico do cliente acessível por OTP, com "pedir novamente" | ✅ |
| Carrinhos abandonados recuperados com rastreio | ✅ |
| XML atualiza custos só após conferência | ✅ |
| IA propõe, humano aprova (motor) | ✅ |
| Zero hardcode da Casa Roxa em código | ⚠️ Parcial — algumas categorias de produto e textos ainda hardcoded; revisar antes da extração SaaS |

## Próximas ideias (pós go-live, baseadas em uso real)

Lista intencionalmente sem prioridade — vai se reorganizar conforme o que Bruno descobrir nas primeiras semanas operando:

- Conectar tools do chat IA ao `proposeAction` (P0 antes do go-live)
- Reservas de mesa (consumo presencial)
- Cashback como alternativa ao cartão fidelidade
- Comissão por vendedor/atendente
- Devolução / estorno parcial
- Programa de embaixador (cliente fiel ganha % de quem indicar)
- Push notification de promoções segmentadas
- Loja de assinaturas (combo mensal via PIX recorrente)
- Cardápio com vídeo curto TikTok-style
- Integração com iFood (canal complementar)
- `ProductionPlan` persistido com tasks marcáveis
- Templates oficiais Meta (Cloud API) pra campanhas em massa
- Análise de churn de cliente

## Definition of Done (mantido)

- Fluxo completo: UI + validação + banco + logs + estados de erro
- Sem regra crítica hardcoded da Casa Roxa
- Validação de permissão em toda action de escrita
- Eventos importantes com log de auditoria
- Cálculos financeiros usam **snapshot** (preservar histórico)
- Relatórios mostram lucro/CMV quando há impacto financeiro
- WhatsApp com rate limit + opt-in + toggle
- Features de risco operacional têm confirmação manual (dupla quando irreversível)
- README e doc de produto atualizados ao final de cada Sprint

---

## Anotações do dev (Bruno)

_Espaço pra anotar decisões durante a execução, divergências do plano, e o que aprender com a operação real._

- **2026-05-14:** maratona de Sprints 2–9 em 1 dia. Todas entregues + deployed em prod. Crash do Postgres durante a maratona por disco cheio (containerd com 73GB) — mitigado por cleanup automático em `/usr/local/bin/casaroxa-disk-cleanup.sh` rodando diariamente.
- **2026-05-14:** decidido abrir em ~30 dias. Antes do go-live: semana inteira de testes em família.
- **2026-05-15:** próxima sessão é de documentação (este doc + manual de uso + site público). Sem código novo até a revisão do time.
