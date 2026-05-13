# Roadmap de Evolução — Casa Roxa Gestão → SaaS Simplifica

> Documento elaborado pela equipe de produto/marketing.
> Versão 1.0 — Maio/2026.
> Origem: Bruno + time de produto, após análise do estado atual.

## Resumo da tese

Não competir como "mais um cardápio digital". Posicionar como **plataforma de venda direta** com inteligência de margem, produção, recompra e marketing. Validar tudo na Casa Roxa primeiro; extrair pra SaaS Simplifica depois.

## Fases

| Fase | Objetivo | Quando avançar |
|---|---|---|
| 1. MVP operacional | Rodar delivery real sem planilha | Pedidos rolando sem dependência manual |
| 2. Motor de crescimento | Provar recompra e campanhas | Campanhas rastreáveis com lucro medido |
| 3. Inteligência operacional | IA ajuda decisões com aprovação | IA útil em decisões reais |
| 4. Extração SaaS | Multi-tenant, billing, onboarding | 1º cliente externo sem custom pesado |

## P0 antes do deploy final Casa Roxa

1. **KDS / Tela de cozinha** — fila em tempo real, tempo decorrido
2. **Comprovante de pedido** — espelho do que rifa já tem
3. **Pré-venda do fim de semana** — produção planejada, lote, janela

## Sprints planejadas (revisadas após leitura crítica)

| # | Entrega |
|---|---|
| 1 | **Estabilização operacional**: KDS (polling 5s), comprovante de Sale, staging, backup/restore, testes mínimos de pagamento, correções operacionais (URL webhook na UI, etc) |
| 2 | Pré-venda do fim de semana + disponibilidade por lote |
| 3 | Planejamento de produção + lista de compras |
| 4 | Meus Pedidos + reorder |
| 5 | **Campanhas simples (antes do NPS)** + públicos fixos (4-6 segmentos pré-definidos, sem query builder) |
| 6 | NPS pós-entrega — agora com campanha pra agir (recuperar insatisfeito, pedir indicação de satisfeito, cupom de recompra) |
| 7 | Carrinho abandonado + upsells + cardápio orientado a ticket |
| 8 | **Evolução de Compras/XML** (não criação): matching melhor, impacto no CMV, histórico de custo, sugestão de reajuste |
| 9 | IA operacional com atalhos + `AiActionApproval` (nova entidade, aprovação de escrita) |

## Decisões revisadas (após leitura crítica)

- **Sem multi-tenant agora** — só parametrização de marca/textos/cores/domínio/logo dentro de `Settings`.
- **Settings será refatorado** (não criar `BusinessProfile`).
- **Públicos fixos** primeiro: inativos 30d, alto ticket, comprou costela, comprou frango, aniversariantes, recorrentes. Query builder só na Fase 4.
- **WhatsApp em campanha** com limite por dia, opt-in obrigatório, base pequena.
- **KDS com polling** (5s), não WebSocket. Evolui se operação exigir.
- **AiUsageLog já existe** — só `AiActionApproval` é entidade nova.
- **Purchase/PurchaseItem já existem** — Sprint 8 é evolução, não criação.
- **Backup/restore + staging + testes mínimos de pagamento** são P0, entram na Sprint 1.

## Módulos novos a construir

- **Motor de Campanhas** (`Campaign`, `CampaignAudience`, `CampaignOrderAttribution`)
- **Públicos Inteligentes** (`Audience`, `AudienceRule`)
- **Carrinho Abandonado** (`AbandonedCart`)
- **Pré-venda / Sales Event** (`SalesEvent`, `SalesEventProduct`, `PickupWindow`, `DeliveryWindow`)
- **Planejamento de Produção** (`ProductionPlan`, `ProductionTask`)
- **NPS / Avaliações** (`CustomerReview`)
- **Compras XML/NFe** (`Purchase`, `PurchaseItem`, `InventoryLot`, `Supplier`, `IngredientAlias`)
- **IA com aprovação** (`AiUsageLog`, `AiActionApproval`)
- **Multi-tenant** (`BusinessProfile`)

## Parametrização obrigatória (preparar SaaS)

- Nome/marca → `BusinessProfile.name`, `brandColor`, `brandTagline`
- Categorias do cardápio → cadastráveis por empresa
- Domínio → `publicDomain` / `adminDomain` por tenant
- Mensagens WhatsApp → templates com variáveis
- Regras de pré-venda → genérico (não amarrar a "assados")

## Critérios globais de aceite

1. Cliente faz pedido, paga, acompanha
2. Admin opera cozinha em tempo real (KDS)
3. Sistema planeja produção a partir de pedidos confirmados
4. Custo/CMV/lucro visíveis por produto, combo, campanha
5. Campanhas rastreáveis a pedidos
6. Histórico do cliente acessível por OTP, com "pedir novamente"
7. Carrinhos abandonados recuperados com rastreio
8. XML atualiza custos só após conferência
9. IA propõe, humano aprova
10. Zero hardcode da Casa Roxa em código (tudo é config)

## Definition of Done

- Fluxo completo: UI + validação + banco + logs + estados de erro
- Sem regra crítica hardcoded da Casa Roxa
- Validação de permissão em toda action de escrita
- Eventos importantes com log de auditoria
- Cálculos financeiros usam **snapshot** (preservar histórico)
- Relatórios mostram lucro/CMV quando há impacto financeiro
- WhatsApp com limite + opt-in + toggle
- Features de risco operacional têm modo teste / confirmação manual
- README atualizado: env vars, tabelas novas, endpoints, instruções

---

## Anotações do dev (Bruno)

_Espaço pra anotar decisões durante a execução, divergências do plano, e o que aprender com a operação real._
