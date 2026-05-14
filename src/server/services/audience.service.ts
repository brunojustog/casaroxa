/**
 * Audiências fixas (Sprint 5).
 *
 * 6 públicos pré-definidos. Cada audiência é uma query que retorna
 * Customer[] elegíveis pra receber uma campanha (marketingOptIn=true,
 * active=true, com telefone válido).
 *
 * Roadmap: query builder dinâmico (Audience/AudienceRule) só na Fase 4.
 */
import { CampaignAudienceKey, ProductCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AudienceCustomer = {
  id: string;
  name: string;
  phone: string;
};

export const AUDIENCE_LABEL: Record<CampaignAudienceKey, string> = {
  BIRTHDAY_MONTH: "Aniversariantes do mês",
  INACTIVE_30D: "Inativos há 30 dias",
  RECURRING: "Recorrentes (3+ pedidos)",
  HIGH_TICKET: "Alto ticket (acima da meta)",
  BOUGHT_CHICKEN: "Comprou frango",
  BOUGHT_BEEF_RIB: "Comprou costela",
  DETRACTORS_30D: "Detratores (NPS) — recuperar",
  PROMOTERS_30D: "Promotores (NPS) — premiar/indicar",
};

export const AUDIENCE_DESCRIPTION: Record<CampaignAudienceKey, string> = {
  BIRTHDAY_MONTH:
    "Clientes que fazem aniversário no mês corrente (com data cadastrada).",
  INACTIVE_30D:
    "Clientes que tinham pedido confirmado, mas nenhum nos últimos 30 dias.",
  RECURRING:
    "Clientes com 3 ou mais pedidos concluídos no histórico.",
  HIGH_TICKET:
    "Clientes cujo ticket médio (pedidos concluídos) supera a meta de Settings.targetAverageTicket.",
  BOUGHT_CHICKEN:
    "Clientes que já compraram pelo menos 1 item da categoria Frango.",
  BOUGHT_BEEF_RIB:
    "Clientes que já compraram pelo menos 1 item da categoria Costela.",
  DETRACTORS_30D:
    "Clientes que deram nota 0-6 nos últimos 30 dias. Use pra cupom de recuperação.",
  PROMOTERS_30D:
    "Clientes que deram nota 9-10 nos últimos 30 dias. Use pra pedir indicação ou premiar.",
};

/**
 * Filtros comuns aplicados em todas as audiências:
 *   - active=true
 *   - marketingOptIn=true
 *   - phone preenchido (não null/empty)
 */
function commonWhereClause() {
  return {
    active: true,
    marketingOptIn: true,
    phone: { not: "" },
  };
}

export async function listCustomersForAudience(
  key: CampaignAudienceKey,
): Promise<AudienceCustomer[]> {
  switch (key) {
    case "BIRTHDAY_MONTH":
      return birthdayMonth();
    case "INACTIVE_30D":
      return inactive30d();
    case "RECURRING":
      return recurring();
    case "HIGH_TICKET":
      return highTicket();
    case "BOUGHT_CHICKEN":
      return boughtCategory("FRANGO");
    case "BOUGHT_BEEF_RIB":
      return boughtCategory("COSTELA");
    case "DETRACTORS_30D":
      return reviewCategory("DETRACTOR");
    case "PROMOTERS_30D":
      return reviewCategory("PROMOTER");
  }
}

// ---------- Implementações ----------

async function birthdayMonth(): Promise<AudienceCustomer[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const rows = await prisma.$queryRaw<AudienceCustomer[]>`
    SELECT id, name, phone
    FROM "Customer"
    WHERE active = true
      AND "marketingOptIn" = true
      AND phone <> ''
      AND birthday IS NOT NULL
      AND EXTRACT(MONTH FROM birthday) = ${month}
    ORDER BY name ASC
  `;
  return rows;
}

async function inactive30d(): Promise<AudienceCustomer[]> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // Cliente que TINHA pedido confirmado antes do cutoff mas nenhum DEPOIS
  const rows = await prisma.$queryRaw<AudienceCustomer[]>`
    SELECT c.id, c.name, c.phone
    FROM "Customer" c
    WHERE c.active = true
      AND c."marketingOptIn" = true
      AND c.phone <> ''
      AND EXISTS (
        SELECT 1 FROM "Sale" s
        WHERE s."customerId" = c.id
          AND s.status = 'CONCLUIDA'
          AND s."occurredAt" < ${cutoff}
      )
      AND NOT EXISTS (
        SELECT 1 FROM "Sale" s
        WHERE s."customerId" = c.id
          AND s.status = 'CONCLUIDA'
          AND s."occurredAt" >= ${cutoff}
      )
    ORDER BY c.name ASC
  `;
  return rows;
}

async function recurring(): Promise<AudienceCustomer[]> {
  const rows = await prisma.$queryRaw<AudienceCustomer[]>`
    SELECT c.id, c.name, c.phone
    FROM "Customer" c
    WHERE c.active = true
      AND c."marketingOptIn" = true
      AND c.phone <> ''
      AND (
        SELECT COUNT(*) FROM "Sale" s
        WHERE s."customerId" = c.id
          AND s.status = 'CONCLUIDA'
      ) >= 3
    ORDER BY c.name ASC
  `;
  return rows;
}

async function highTicket(): Promise<AudienceCustomer[]> {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { targetAverageTicket: true },
  });
  const target = settings?.targetAverageTicket
    ? Number(settings.targetAverageTicket)
    : 75; // default razoável
  const rows = await prisma.$queryRaw<AudienceCustomer[]>`
    SELECT c.id, c.name, c.phone
    FROM "Customer" c
    WHERE c.active = true
      AND c."marketingOptIn" = true
      AND c.phone <> ''
      AND (
        SELECT AVG(s."totalRevenue" - s."couponDiscount")
        FROM "Sale" s
        WHERE s."customerId" = c.id
          AND s.status = 'CONCLUIDA'
      ) > ${target}
    ORDER BY c.name ASC
  `;
  return rows;
}

async function reviewCategory(
  cat: "DETRACTOR" | "PROMOTER",
): Promise<AudienceCustomer[]> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const reviews = await prisma.customerReview.findMany({
    where: {
      category: cat,
      createdAt: { gte: cutoff },
      customer: { is: { ...commonWhereClause() } },
    },
    select: {
      customer: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  // Dedupe — cliente pode ter múltiplas reviews
  const seen = new Set<string>();
  const out: AudienceCustomer[] = [];
  for (const r of reviews) {
    if (!r.customer) continue;
    if (seen.has(r.customer.id)) continue;
    seen.add(r.customer.id);
    out.push({ id: r.customer.id, name: r.customer.name, phone: r.customer.phone });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return out;
}

async function boughtCategory(
  category: ProductCategory,
): Promise<AudienceCustomer[]> {
  const customers = await prisma.customer.findMany({
    where: {
      ...commonWhereClause(),
      sales: {
        some: {
          status: "CONCLUIDA",
          items: {
            some: {
              OR: [
                { product: { category } },
                { combo: { category } },
              ],
            },
          },
        },
      },
    },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  });
  return customers;
}
