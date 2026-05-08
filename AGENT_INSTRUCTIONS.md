# Instruções para o agente noturno — Casa Roxa

> Este documento é a fonte de verdade para o trabalho autônomo da noite de
> 2026-05-07. Cada vez que o cron acordar, **leia este arquivo primeiro** antes
> de decidir o que fazer.

## Contexto

Bruno autorizou trabalho autônomo por uma noite (~8h) para evoluir o sistema
Casa Roxa Gestão de Custos. O MVP (fases 1–10) está completo no `main`. Toda
modificação acontece na branch `overnight/estoque-compras`.

## Diretório

Todo trabalho em `C:\Users\PC\casa-roxa-gestao`. Nunca saia desta pasta.

## Escopo desta noite (em ordem de prioridade)

### Fase 11 — Estoque base (PRIORIDADE)

**Schema novo:**

```prisma
enum StockMovementType {
  ENTRADA      // compra ou ajuste positivo
  SAIDA        // venda ou ajuste negativo
  PERDA        // descarte / vencimento
  AJUSTE       // correção manual de inventário
}

model StockMovement {
  id           String            @id @default(cuid())
  ingredientId String
  type         StockMovementType
  quantity     Decimal           @db.Decimal(12, 4)  // sempre positivo; o type indica direção
  unitCost     Decimal?          @db.Decimal(12, 4)  // custo no momento (para entradas)
  lotNumber    String?
  expiryDate   DateTime?
  notes        String?
  referenceType String?          // "PURCHASE", "MANUAL", "SALE" etc. (futuro)
  referenceId   String?
  userId       String?
  createdAt    DateTime          @default(now())

  ingredient Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Restrict)
  user       User?      @relation(fields: [userId], references: [id])

  @@index([ingredientId, createdAt])
  @@index([type, createdAt])
  @@index([expiryDate])
}
```

Adicionar relação inversa em Ingredient:
```
stockMovements StockMovement[]
```

E em User:
```
stockMovements StockMovement[]
```

**Service** (`src/server/services/stock.service.ts`):
- `getStockBalance(ingredientId)` — soma dos movimentos (entrada + ajuste positivo - saída - perda - ajuste negativo)
- `getAllStockBalances()` — saldo de todos ingredientes ativos
- `listMovements(filters)` — filtros: ingrediente, tipo, range de datas
- `registerMovement({ingredientId, type, quantity, unitCost?, lotNumber?, expiryDate?, notes?, userId})` — cria + retorna saldo novo
- `getExpiringSoon(daysThreshold)` — itens vencendo em até N dias (consulta StockMovement entradas com expiryDate, deduzindo saídas FIFO opcional)
- `getLowStock(threshold)` — itens abaixo de um limite (por enquanto, threshold global; depois por ingrediente)

**Schema Zod** (`src/schemas/stock.schema.ts`):
- `stockMovementFormSchema` para o form de lançamento manual
- `stockMovementListFiltersSchema`

**Server actions** (`src/server/actions/stock.ts`):
- `registerStockMovementAction(raw)` com requireAuth, validação Zod, runAction
- `revalidatePath("/estoque")`, `/dashboard`

**UI:**
- `/estoque` — lista de saldos por ingrediente, com busca/filtro categoria, link "Lançar movimento"
- `/estoque/lancar` — form com seletor de ingrediente, tipo, quantidade, custo unitário (só pra entrada), lote, validade, notas
- `/estoque/[ingredientId]` — histórico de movimentos do ingrediente + saldo atual + botão "lançar"
- Adicionar item "Estoque" na Sidebar (`src/components/layout/Sidebar.tsx`) com ícone Warehouse ou Package2 da lucide-react

**Dashboard updates** (`src/server/services/dashboard.service.ts`):
- Adicionar 2 alertas:
  - "Itens vencendo em ≤7 dias" → href `/estoque?filter=expiring`
  - "Ingredientes com saldo zerado mas usados em fichas" → href `/estoque?filter=empty`
- Adicionar 1 KPI: "Movimentos do mês" (count de StockMovement criados nos últimos 30 dias)

**Critério de pronto Fase 11:**
- [ ] `npx tsc --noEmit` zerado
- [ ] `npm run lint` zerado
- [ ] `npm run db:push` aplica sem erro (banco está em Docker rodando)
- [ ] Página /estoque renderiza com saldos
- [ ] Lançar movimento manual funciona (entrada e saída)
- [ ] Histórico por ingrediente mostra movimentos
- [ ] Alertas de validade aparecem no dashboard quando aplicável
- [ ] Commit isolado: `feat: fase 11 — estoque base`
- [ ] README atualizado com seção Estoque

### Fase 12 — Compras + Fornecedores

**Schema:**

```prisma
model Supplier {
  id            String   @id @default(cuid())
  name          String   @unique
  cnpj          String?  @unique
  contactPerson String?
  phone         String?
  email         String?
  notes         String?
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  purchases  Purchase[]
}

enum PurchaseStatus {
  RASCUNHO
  CONFIRMADA
  CANCELADA
}

model Purchase {
  id          String         @id @default(cuid())
  supplierId  String?
  invoiceNumber String?
  invoiceDate DateTime
  totalAmount Decimal        @db.Decimal(14, 2)
  status      PurchaseStatus @default(RASCUNHO)
  notes       String?
  userId      String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  supplier Supplier?      @relation(fields: [supplierId], references: [id])
  user     User?          @relation(fields: [userId], references: [id])
  items    PurchaseItem[]

  @@index([invoiceDate])
  @@index([supplierId])
}

model PurchaseItem {
  id            String   @id @default(cuid())
  purchaseId    String
  ingredientId  String
  quantity      Decimal  @db.Decimal(12, 4)
  unitCost      Decimal  @db.Decimal(12, 4)
  totalCost     Decimal  @db.Decimal(14, 2)
  lotNumber     String?
  expiryDate    DateTime?
  updateIngredientCost Boolean @default(true)  // se true, ao confirmar atualiza Ingredient.unitCost
  createdAt     DateTime @default(now())

  purchase   Purchase   @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  ingredient Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Restrict)

  @@index([purchaseId])
  @@index([ingredientId])
}
```

Promover relações em Ingredient e User.

**Comportamento crítico:**
- Quando uma `Purchase` muda de RASCUNHO para CONFIRMADA, o service:
  - Cria um `StockMovement` ENTRADA para cada `PurchaseItem`
  - Se `updateIngredientCost=true`, atualiza `Ingredient.unitCost` E DISPARA `applyIngredientPriceChange` da `recalculation.service.ts` (cascata para fichas → produtos → combos)
  - Tudo numa transação Prisma

**UI:**
- `/fornecedores` — CRUD simples (nome, CNPJ, contato, telefone)
- `/compras` — lista com busca, filtros por fornecedor e status
- `/compras/nova` — form com cabeçalho (fornecedor, data, número NF) + tabela editável de itens (ingrediente + qtd + custo unitário + lote + validade + checkbox "atualizar custo")
- `/compras/[id]` — visualizar/editar; botão "Confirmar" se RASCUNHO; "Cancelar"
- Sidebar: adicionar "Fornecedores" e "Compras"

**Critério de pronto Fase 12:**
- [ ] tsc/lint/build zerados
- [ ] CRUD de fornecedores funcional
- [ ] Criar uma compra → confirmar → ver estoque aumentar + custo do ingrediente atualizado + ficha técnica + combo recalculados
- [ ] Commit: `feat: fase 12 — compras + fornecedores`

### Fase 13 — Importação de NFe XML (se sobrar tempo)

**Service** (`src/server/importers/nfe-importer.ts`):
- Parser de XML de NFe (formato SEFAZ padrão). Bibliotecas: `fast-xml-parser` (adicionar como dep) ou parser nativo simples. NFe tem `<infNFe>` com `<emit>` (emitente=fornecedor) e `<det>` (cada item) com `<prod>` contendo `cProd`, `xProd` (descrição), `qCom` (quantidade), `vUnCom` (valor unitário), `vProd` (total), `cEAN`, `NCM`.
- Função `parseNfe(xmlBuffer): ParsedNfe` retorna `{supplier: {cnpj, name}, invoice: {number, date}, items: [{xProd, qCom, vUnCom, ...}]}`
- Função `matchItemsToIngredients(items)` — fuzzy match de `xProd` contra `Ingredient.name`. Retorna `[{nfItem, suggestion?: Ingredient, score}]`. Use levenshtein simples (sem dep nova) ou matching por palavras-chave.

**UI** (`/compras/importar-nfe`):
- Upload do XML
- Tela de preview: cada linha mostra item da NF + sugestão de ingrediente (com dropdown pra trocar) + checkbox "criar novo se não casar"
- Confirmar → cria Purchase em status CONFIRMADA com tudo

**Critério de pronto Fase 13:**
- [ ] tsc/lint/build zerados
- [ ] Upload de XML funciona
- [ ] Preview mostra matching
- [ ] Confirmar cria Purchase + StockMovements + cascata
- [ ] Commit: `feat: fase 13 — importação NFe XML`

### Fase 14 — Chat IA — NÃO FAZER ESTA NOITE

Bruno quer presente para isso (custos, decisões de UX).

## Regras absolutas

1. **NUNCA** rodar `npm run db:reset` ou `prisma migrate reset` — apaga os
   dados que Bruno tem.
2. **NUNCA** fazer `git push` (não tem remote configurado mesmo).
3. **NUNCA** fazer `git commit --amend` ou `git reset --hard` em commits já
   feitos.
4. **NUNCA** sair da branch `overnight/estoque-compras`.
5. **NUNCA** modificar `.env` (pode ler para conferir DATABASE_URL).
6. **NUNCA** mexer em `prisma/seed.ts` exceto para adicionar dados das novas
   tabelas (StockMovement, Supplier).
7. **NÃO** instalar deps grandes sem necessidade. `fast-xml-parser` está OK
   para Fase 13.
8. **SEMPRE** rodar `npx tsc --noEmit` e `npm run lint` antes de commitar.
9. **SEMPRE** commits pequenos e descritivos. Cada subfase = 1 commit.
10. **SEMPRE** ler este arquivo no começo de cada wake-up.

## Workflow a cada wake-up

1. `git status` para ver onde está
2. Ler `AGENT_INSTRUCTIONS.md` (este arquivo) — pode ter sido atualizado
3. Ler `OVERNIGHT_LOG.md` (criar se não existir) — log de progresso da noite
4. Identificar próxima tarefa não feita do roadmap acima
5. Trabalhar nela até um ponto natural de commit (módulo coerente)
6. Validar (tsc + lint)
7. `git add -A && git commit -m "..."`
8. Apender entrada em `OVERNIGHT_LOG.md` com timestamp + o que fez + próximo passo
9. Encerrar a sessão (parar de trabalhar; cron acordará novamente)

## Orçamento de tempo (estimativa)

- Fase 11: 4-5h
- Fase 12: 2-3h
- Fase 13: 1-2h (provavelmente parcial)

A noite tem ~8h. Se ao acordar você ver que já são 6:30 da manhã, pare em
ponto natural e atualize o OVERNIGHT_LOG com status "PARANDO PRA REVIEW DO
USUÁRIO".

## Status / Progresso

Veja `OVERNIGHT_LOG.md` para o histórico atualizado a cada commit.

## Em caso de erro irrecuperável

- TS error que você não consegue resolver em 2 tentativas: reverta o último
  commit (`git reset --hard HEAD~1`) e pule pra próxima fase.
- DB connection error: pare. Apende em OVERNIGHT_LOG "BLOQUEADO: banco fora
  do ar — esperando Bruno".
- Conflito imprevisto: pare. Apende em OVERNIGHT_LOG e aguarde manhã.

## Sucesso = Bruno acorda e

1. Faz `git log` e vê 2-3 commits descritivos
2. Faz `git diff main` e revisa cada mudança
3. Roda `npm run db:push && npm run dev` e testa as novas telas
4. Aprova ou pede ajustes
