# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js 15 (App Router) + React 19 + TypeScript · Prisma 5 + PostgreSQL 16 (Docker Compose) · Auth.js v5 (Credentials) · Tailwind · React Hook Form + Zod · `decimal.js` + `Prisma.Decimal` · Anthropic SDK (chat IA, fase 14).

App and content are in **Portuguese (pt-BR)** — routes, UI strings, commit messages and code comments follow this convention.

## Common commands

```bash
docker compose up -d           # Postgres
npm run dev                    # Next dev (http://localhost:3000)
npm run db:push                # apply schema.prisma to DB without migration file
npm run db:migrate             # create + apply a new migration
npm run db:seed                # idempotent seed (admin + settings + ingredientes/produtos/fichas/combos)
npm run db:studio              # Prisma Studio
npm run lint                   # ESLint (next lint)
npx tsc --noEmit               # type check (no built-in script — call directly)
npm run build                  # production build
```

There is **no test runner configured** — don't invent `npm test`. Validation gates are `npx tsc --noEmit` and `npm run lint`.

Default seed login: `admin@casaroxa.local` / `casa-roxa-2026` (override via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`).

## Architecture (the parts you can't see from one file)

### Layers

```
src/app/            App Router pages + route handlers (RSC by default)
src/server/actions/ "use server" entry points — auth + validation + delegate
src/server/services/ Prisma-bound business logic; receives a TransactionClient where cascade is needed
src/server/importers/ + exporters/   XLSX, NFe XML, CSV, PDF
src/domain/         Pure functions, ZERO Prisma — calculations, status, types
src/schemas/        Zod schemas — shared between client (RHF) and server (actions)
src/lib/            prisma client, decimal helpers, format, enums, utils
```

Server actions follow a single pattern via [src/server/auth-helpers.ts](src/server/auth-helpers.ts):

```ts
export async function fooAction(raw: unknown) {
  return runAction(async () => {
    await requireAuth();
    const data = fooSchema.parse(raw);
    return await fooService.doSomething(data);
  });
}
```

`runAction` returns `ActionResult<T> = { ok: true; data? } | { ok: false; error }`. `BusinessError` and `UnauthorizedError` messages bubble to the client; anything else is logged and returns a generic message.

### Recalculation cascade — central invariant

[src/server/services/recalculation.service.ts](src/server/services/recalculation.service.ts) is the single source of truth for cost propagation:

```
Ingredient.unitCost changes
  → applyIngredientPriceChange(tx, ingredientId, newCost)
     → updates RecipeItem.unitCostSnapshot + totalCost
     → recalculateRecipeAndCascade(tx, recipeId) for each affected Recipe
        → Recipe.totalCost = Σ items
        → Product.totalCost = Recipe.totalCost
        → cascadeProductCostToCombos(tx, productId, newCost)
           → updates ComboItem snapshots + Combo.totalCost
```

Every entry point that mutates costs **must** run inside a single `prisma.$transaction(async (tx) => …)` and call into this service — never bypass. The flows that hit it:

- ingrediente price edit (`ingredient.service`)
- saving a recipe (`recipe.service`)
- saving a combo (`combo.service`)
- XLSX import (`importers/`) — same transaction per upload
- **confirming a Purchase** (`purchase.service`) — when `PurchaseItem.updateIngredientCost=true`, creates `StockMovement` ENTRADA + updates `Ingredient.unitCost` + calls `applyIngredientPriceChange`. Cancelling a confirmed purchase must reverse the movements.

The `unitCostSnapshot` columns on `RecipeItem`/`ComboItem` and `totalCost` on `Recipe`/`Product`/`Combo` are **denormalized caches** of this cascade. Don't read live ingredient cost in calculations — read the snapshot.

### Status is computed, not stored

`Product.status` (the user-facing `OK / Sem custo / Sem preço / Rever`) is **not** the Prisma `ProductStatus` enum (which is `ATIVO/INATIVO/SOB_ENCOMENDA`). The user-visible status is derived per-read by [src/domain/status.ts](src/domain/status.ts) from `(totalCost, salePrice, targetCmv, settings.defaultCmv*)`. Do not persist it.

### Money — never use raw `+` / `*`

All monetary and quantity arithmetic goes through [src/lib/decimal.ts](src/lib/decimal.ts): `toDecimal`, `sumDecimal`, `roundMoney` (2 casas), `roundUnit` (4 casas). `Prisma.Decimal` values stringify safely; `Number(x)` loses precision and is only acceptable for display rounding at the very end. The Postgres columns use `Decimal(12,4)` for unit costs/quantities and `Decimal(14,2)` or `Decimal(12,2)` for monetary totals; `Decimal(5,4)` for percentages stored as fractions (0.50 = 50%).

### Auth split (Edge vs Node)

Auth.js v5 needs an Edge-safe config for the middleware (no Prisma, no bcrypt) and a full config for the rest:

- [src/server/auth.config.ts](src/server/auth.config.ts) — Edge-safe, imported by [src/middleware.ts](src/middleware.ts)
- [src/server/auth.ts](src/server/auth.ts) — full config with PrismaAdapter + Credentials provider

The middleware redirects any non-`/login`, non-`/api/auth/*`, non-static path to `/login?callbackUrl=…` when unauthenticated. Don't add Prisma/bcrypt imports to `auth.config.ts` — it'll break the middleware build.

### Recipe review flag

Saving a recipe through `recipe.service` automatically sets `Recipe.reviewed = false`. The intent is that any cost/composition change requires the operator to re-approve before the product is "trusted". The Recipe Review UI shows un-reviewed recipes prominently. Don't paper over this in service code.

### Soft delete pattern

`Ingredient.active`, `Product.active`, `Combo.active`, `Supplier.active` — list pages filter by `active=true` by default with a toggle. **Hard delete is blocked** when the entity is referenced (RecipeItem, ComboItem, PurchaseItem, StockMovement) — services must throw `BusinessError` with a clear message. Use the `active=false` flag for "removed but referenced".

### Stock + Compras (Fases 11–12)

- `StockMovement.quantity` is **always positive**; `type` (ENTRADA/SAIDA/PERDA/AJUSTE) determines the sign. Use PERDA for negative adjustments; AJUSTE is positive-only.
- Balance = `Σ ENTRADA + AJUSTE − SAIDA − PERDA` (computed in `stock.service.ts`, never stored).
- `referenceType`/`referenceId` link a movement back to its origin (e.g. `PURCHASE`/purchase id) so cancelling a purchase can find its movements.

### NFe XML import (Fase 13)

[src/server/services/nfe-import.service.ts](src/server/services/nfe-import.service.ts) parses SEFAZ NFe XML via `fast-xml-parser` and runs a fuzzy match (`xProd` vs `Ingredient.name`) returning suggestions. The user picks/creates ingredients in the preview UI before confirming. Confirmation goes through the same `purchase.service` confirm path — no shortcut around the cascade.

### Chat IA

`ChatConversation` + `ChatMessage` + `AiUsageLog` models. Messages store Anthropic content blocks as JSON in `ChatMessage.content`; token counts and per-call cost (`AiUsageLog.estimatedCostUsd`) are persisted server-side.

**The chat is NOT read-only anymore.** `src/server/ai/tools.ts` exports `TOOLS = [...READ_TOOLS, ...WRITE_TOOLS]` and `chat.service.ts` executes any registered tool. There are ~15 read tools and ~18 write tools in `tools.write.ts` (cancel_sale, update_product_price, register_stock_movement, send_whatsapp_message, draw_raffle, …). Gates are technical: `requiresRole==="ADMIN"` blocks non-admins and `!tool.readOnly && !ctx.userId` blocks expired sessions. `destructive` is only a hint to the model (system prompt asks for textual confirmation), not a hard gate.

Note: two **independent** AI write paths exist and are not connected — (a) these chat tools execute directly against services, and (b) the human-approval engine `services/ai-action.service.ts` (`proposeAction` → `AiActionApproval`, UI `/aprovacoes-ia`). The chat tools do **not** route through the approval queue.

### Agendamento por horário da cozinha (checkout público)

O cardápio público é **sempre visível** (o toggle `Settings.cardapioClosed` só mostra um aviso, não esconde itens). Produtos e combos têm `requiresKitchen` (boolean, default true): itens que dependem da cozinha só saem nos horários de funcionamento configurados em `Settings.kitchenHours` (JSON por dia, ex.: `{"SAB":{"open":"07:00","close":"14:00"},"DOM":{...}}`).

- `src/lib/kitchen-schedule.ts` gera os slots disponíveis (fuso America/Sao_Paulo, offset fixo `-03:00`) e valida a escolha (`isValidKitchenSlot`).
- No checkout (`CheckoutClient`), se o carrinho tem **qualquer** item com `requiresKitchen` (`cartNeedsKitchen`), o cliente escolhe um slot e o pedido vira uma **encomenda agendada** via `POST /api/public/order-request` com `kitchenScheduled: true` (valida contra os slots, não contra `orderLeadTimeHours`). Cai na fila de `/encomendas` pra aprovação, como as demais encomendas.
- Carrinho só com itens de pronta-entrega (`requiresKitchen=false`, ex.: empório/congelados/bebidas) segue o fluxo imediato (`/api/public/order` → Sale). `public-order.service` tem rede de segurança: item de cozinha em pedido imediato é rejeitado.

## Project conventions worth knowing

- All schemas share between client and server via [src/schemas/](src/schemas/) — RHF resolvers and server actions parse the same Zod schema.
- Phase docs ([AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md), [OVERNIGHT_LOG.md](OVERNIGHT_LOG.md)) describe a past autonomous run that delivered fases 11–13. They're historical context, not a current TODO list.
- The `(app)` route group holds all authenticated pages (sidebar+header layout); `(auth)` holds the login page.
- `targetCmv` is stored as a fraction (`0.50` = 50%). All UI conversion to/from percent happens at form boundaries.
- Export endpoints `/api/export/{csv,pdf}?type=…` accept the same query-string filters as the report UI; both require auth.
