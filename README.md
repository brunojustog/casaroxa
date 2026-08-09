# Casa Roxa — Gestão

Sistema de gestão da **Casa Roxa Assados**. Cobre o ciclo completo de operação:
ingredientes, produtos, fichas técnicas com recálculo em cascata, combos,
estoque, compras e fornecedores (com importação NFe XML), vendas (PDV-light com
pagamentos e taxas), custos fixos detalhados, simulador de preços, cenários de
faturamento, DRE/resultado consolidado, assistente IA e relatórios em CSV/PDF.

## Stack

| Camada       | Tecnologia                                         |
| ------------ | -------------------------------------------------- |
| Framework    | Next.js 15 (App Router) + React 19 + TypeScript    |
| UI           | Tailwind CSS + componentes próprios                |
| Forms        | React Hook Form + Zod                              |
| Charts       | Recharts                                           |
| ORM          | Prisma 5                                           |
| Banco        | PostgreSQL 16 (Docker Compose em dev)              |
| Auth         | Auth.js v5 (NextAuth) — Credentials provider       |
| Importação   | xlsx (SheetJS)                                     |
| Exportação   | CSV nativo + jsPDF + jspdf-autotable               |
| Money        | Prisma Decimal + decimal.js (sem float em lugar nenhum) |

## Status

> **Nota:** este README cobre as **Fases 1–10** (núcleo de gestão: catálogo, custos,
> relatórios). O sistema evoluiu muito além disso — site público de venda direta,
> PDV de loja, encomendas, pré-venda, campanhas, fidelidade, NPS, sorteios, fiscal
> NFC-e, IA (chat + aprovações) e agendamento por horário da cozinha no checkout.
> Para o estado atual completo, veja [DOCUMENTO-PRODUTO.md](DOCUMENTO-PRODUTO.md)
> e [CLAUDE.md](CLAUDE.md). O schema tem hoje **~61 models** (não os 15 abaixo).

**Núcleo de gestão completo (Fases 1–10 entregues).**

| Fase | Escopo                                                    | Status |
| ---- | --------------------------------------------------------- | ------ |
| 1    | Foundation — configs, banco, seed, auth, layout shell     | ✅     |
| 2    | Ingredientes — CRUD, busca/filtro, histórico de preço     | ✅     |
| 3    | Produtos — CRUD com cálculo de custo/CMV/lucro            | ✅     |
| 4    | Fichas Técnicas — editor + cascata + versões              | ✅     |
| 5    | Combos — editor + cascata                                 | ✅     |
| 6    | Simulador + Cenários de faturamento                       | ✅     |
| 7    | Relatórios (12) + exportação CSV/PDF                      | ✅     |
| 8    | Configurações + importação XLSX                           | ✅     |
| 9    | Dashboard polido com charts e alertas                     | ✅     |
| 10   | Polish, README, Docker prod                               | ✅     |

## Pré-requisitos

- Node.js 20+
- Docker Desktop (para o Postgres)
- npm 10+

## Bootstrap (passo a passo)

```bash
# 1. Subir o Postgres
docker compose up -d

# 2. Variáveis de ambiente
cp .env.example .env
# (edite .env se quiser. Para gerar AUTH_SECRET: openssl rand -base64 32)

# 3. Instalar dependências
npm install

# 4. Aplicar schema e popular dados iniciais
npm run db:push
npm run db:seed

# 5. Subir o app
npm run dev
```

Abra http://localhost:3000 → será redirecionado para `/login`.

**Credenciais padrão (do seed):**
- E-mail: `admin@casaroxa.local`
- Senha: `casa-roxa-2026`

> Mude essas credenciais antes de qualquer uso real (`SEED_ADMIN_EMAIL` e
> `SEED_ADMIN_PASSWORD` no `.env`).

## Scripts

| Comando             | O que faz                                              |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Inicia Next em modo dev (`http://localhost:3000`)      |
| `npm run build`     | Build de produção                                      |
| `npm start`         | Roda o build de produção                               |
| `npm run db:push`   | Aplica o `schema.prisma` no banco (sem migration file) |
| `npm run db:migrate`| Cria/aplica uma migration nova                         |
| `npm run db:reset`  | **Apaga** o banco e re-roda migrations + seed          |
| `npm run db:seed`   | Roda o seed (idempotente)                              |
| `npm run db:studio` | Abre Prisma Studio                                     |
| `npm run lint`      | Lint Next.js                                           |

## Áreas do app

### `/dashboard`
Visão geral em tempo real:
- 8 KPIs (contagens, CMV médio de produtos/combos, faturamento alvo, etc.)
- **Alertas inteligentes** com link clicável (produtos sem custo, sem preço, CMV
  acima da meta, ingredientes sem preço, combos vazios, etc.)
- 5 charts (Recharts): distribuição de produtos por categoria, CMV médio por
  categoria, top 5 lucro produtos, top 5 CMV produtos, top 5 lucro combos
- 6 atalhos para ações rápidas

### `/ingredientes`
- CRUD completo com busca e filtros (categoria, ativos/inativos)
- Auto-cálculo de custo unitário a partir de preço × tamanho da embalagem
- Histórico de alterações de preço
- Painel "onde é usado" com lista de produtos que consomem o ingrediente
- Soft delete (inativar) ou hard delete (bloqueado se em uso)
- **Cascata automática**: alterar preço aqui recalcula fichas + produtos + combos

### `/produtos`
- CRUD completo com busca e filtros (categoria, status operacional, ativos)
- Status computado em tempo real: OK / Sem custo / Sem preço / Rever
- Histórico de alterações de preço de venda
- Resumo financeiro (custo, preço, CMV colorido, lucro bruto)
- Ficha técnica embutida na visualização (link para edição)
- Duplicar produto (clona ficha técnica também)

### `/fichas-tecnicas`
- Lista de produtos com status: sem ficha / não revisada / revisada
- Editor inline com cálculo em tempo real
  - 4 cards reativos: custo · preço · CMV · lucro
  - Adicionar/remover/editar ingredientes
  - Custo unitário e total recalculam ao digitar
- Salvar versão (snapshot JSON em `RecipeVersion`)
- Marcar revisada / desmarcar revisão
- **Salvar zera a flag de revisão** — operador precisa re-aprovar

### `/combos`
- CRUD completo com busca e filtros
- Editor reativo (espelha o de fichas, mas escolhe produtos)
- Duplicar combo (cópia inicia inativa)
- Custo dos produtos é puxado em tempo real

### `/simulador`
Calculadora de preço:
- Tipo (Produto/Combo) → seleção do alvo → mostra estado atual
- Meta CMV (%) → preço sugerido automático
- Novo preço a testar → CMV/lucro simulados
- Taxas de cartão/app/desconto → CMV e lucro líquidos
- "Aplicar preço ao produto/combo" → atualiza salePrice e dispara histórico
- "Salvar simulação" → persiste em `PriceSimulation`
- Sidebar com simulações recentes

### `/cenarios`
- Lista em cards com todas as métricas (faturamento, lucro bruto, resultado, payback)
- **Comparação tabular automática** quando há 2+ cenários
- Form com preview reativa (vê o resultado conforme edita)
- Snapshot do custo fixo no momento do save (premissas mudam → re-edita)

### `/relatorios`
12 relatórios com filtros e exportação CSV/PDF:
1. Produtos por CMV
2. Produtos mais lucrativos
3. Produtos sem preço
4. Produtos sem custo
5. Ingredientes mais caros
6. Ingredientes mais usados
7. Combos por lucro bruto
8. Combos por CMV
9. Fichas técnicas pendentes de revisão
10. Histórico de preços de ingredientes
11. Histórico de preços de venda
12. Cenários salvos

Endpoints de export: `/api/export/csv?type=...` e `/api/export/pdf?type=...`
(autenticados; aceitam os mesmos filtros da UI via query string).

### `/configuracoes`
Form completo das premissas globais:
- Identificação (nome do negócio)
- Operação e investimento (custo fixo, ticket alvo, etc.)
- Metas de CMV padrão por categoria (7 categorias)
- Taxas de venda (cartão, app)
- Perdas médias por carne (4 tipos)

Botão "Restaurar padrão" + sidebar com histórico de alterações.

### `/importar`
Upload de XLSX → preview → confirmação:
- Suporta abas: `Ingredientes`, `Produtos`, `Ficha_Tecnica`, `Combos`,
  `Combo_Itens`
- Nomes de colunas e abas case/acento-insensitive, com aliases comuns
- Modos: upsert · criar somente · atualizar somente
- Preview com diff (criar/atualizar/pular/erros) antes de executar
- Execução em **uma única transação Prisma** com cascata
- Histórico de importações (`ImportLog`)

## Estrutura de pastas

```
casa-roxa-gestao/
├── prisma/
│   ├── schema.prisma           # ~61 models, ~40 enums (era 15 nas Fases 1–10)
│   └── seed.ts                 # admin + settings + 65 ingredientes
│                               # + 33 produtos + fichas + 16 combos
├── src/
│   ├── app/                    # rotas (App Router)
│   │   ├── (auth)/login/       # página de login
│   │   ├── (app)/              # rotas autenticadas (sidebar+header)
│   │   │   ├── dashboard/
│   │   │   ├── ingredientes/[id|novo]/
│   │   │   ├── produtos/[id|novo]/
│   │   │   ├── fichas-tecnicas/[productId]/
│   │   │   ├── combos/[id|novo]/
│   │   │   ├── simulador/
│   │   │   ├── cenarios/[id|novo]/
│   │   │   ├── relatorios/[tipo]/
│   │   │   ├── configuracoes/
│   │   │   └── importar/
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       └── export/{csv,pdf}/route.ts
│   ├── components/
│   │   ├── ui/                 # primitivos (Button, Input, Card, …)
│   │   ├── layout/             # Sidebar, Header, PageHeader
│   │   ├── dashboard/charts/   # Recharts components
│   │   ├── ingredients/        # form, filtros, ações
│   │   ├── products/           # form, filtros, ações, status badge
│   │   ├── recipes/            # editor + revisão
│   │   ├── combos/             # editor, filtros, ações
│   │   ├── simulator/          # PriceSimulator
│   │   ├── scenarios/          # form, ações
│   │   ├── reports/            # tabela genérica, filtros, export
│   │   ├── importer/           # uploader + preview
│   │   └── settings/           # SettingsForm
│   ├── server/
│   │   ├── auth.ts             # config Auth.js v5 (full)
│   │   ├── auth.config.ts      # config Edge-safe (middleware)
│   │   ├── auth-helpers.ts     # requireAuth, runAction
│   │   ├── actions/            # server actions por domínio
│   │   ├── services/           # lógica de negócio (Prisma)
│   │   │   └── recalculation.service.ts  # cascata centralizada
│   │   ├── importers/          # XLSX
│   │   └── exporters/          # CSV, PDF
│   ├── domain/                 # 100% puro, zero Prisma
│   │   ├── calculations.ts     # CMV, lucro, preço sugerido, cenário
│   │   ├── status.ts           # status computado
│   │   └── types.ts
│   ├── schemas/                # Zod (compartilhado client/server)
│   ├── lib/                    # prisma, decimal, format, enums, utils
│   └── middleware.ts           # proteção de rotas (Auth.js)
├── docker-compose.yml          # Postgres
├── Dockerfile                  # multi-stage para produção
└── .env.example
```

## Conceitos centrais

### CMV (Custo da Mercadoria Vendida)

`CMV = custo total / preço de venda`. Expresso como percentual.

Cada categoria tem uma **meta de CMV** padrão configurável em
`/configuracoes`:

| Categoria         | Meta padrão |
| ----------------- | ----------- |
| Frango / Costela / Suínos | 50% |
| Acompanhamentos / Extras | 35% |
| Bebidas           | 70% |
| Combos            | 45% |

### Status computado

Não fica armazenado no banco — é calculado a cada leitura via
`src/domain/status.ts`:

| Status                | Quando                                       | Cor       |
| --------------------- | -------------------------------------------- | --------- |
| `OK`                  | tudo certo                                   | verde     |
| `Sem custo`           | custo total = 0 (ficha técnica vazia)        | vermelho  |
| `Sem preço`           | preço de venda vazio ou 0                    | amarelo   |
| `Rever preço/custo`   | CMV acima da meta                            | laranja   |

### Cascata de recálculo

Implementada em `src/server/services/recalculation.service.ts` e
acionada automaticamente em três fluxos:

```
Editar preço de ingrediente
  → applyIngredientPriceChange()
    → atualiza unitCostSnapshot/totalCost de todos RecipeItems
    → recalculateRecipeAndCascade() para cada Recipe afetada
      → atualiza Recipe.totalCost, Product.totalCost
      → cascadeProductCostToCombos()
        → atualiza ComboItem snapshots e Combo.totalCost
```

Outros pontos de entrada:
- Salvar ficha técnica → recalcula recipe + cascata combos
- Salvar combo → recalcula combo (sem cascata adicional)
- Importar XLSX → mesma cascata aplicada por aba

Tudo dentro de **uma única transação Prisma** para garantir consistência.

### Decimais (sem float)

Valores monetários e quantidades usam `Prisma.Decimal` no banco e `decimal.js`
em runtime. Helpers em `src/lib/decimal.ts`:

- `toDecimal(value)` — normaliza qualquer valor numérico
- `sumDecimal([...])` — soma sem perder precisão
- `roundMoney(value)` — arredonda para 2 casas
- `roundUnit(value)` — arredonda para 4 casas

**Nunca** faça aritmética com `+` ou `*` direto em valores que vieram do
Prisma — use os helpers.

## Backup do banco

```bash
# Backup
docker exec casa-roxa-postgres pg_dump -U casaroxa casa_roxa > backup_$(date +%F).sql

# Restore
docker exec -i casa-roxa-postgres psql -U casaroxa -d casa_roxa < backup_2026-05-07.sql
```

## Deploy em produção (Docker)

A imagem do `Dockerfile` é multi-stage e produz uma imagem de produção pronta.

```bash
# 1. Configure secrets
export AUTH_SECRET="$(openssl rand -base64 32)"

# 2. Descomente o serviço `app` em docker-compose.yml e:
docker compose up -d --build

# 3. Primeira execução: aplique migrations e seed
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run db:seed
```

Cuidado para **trocar a senha do admin** seedado antes de expor a app na
internet.

## Licença

Privado. Casa Roxa Assados.
