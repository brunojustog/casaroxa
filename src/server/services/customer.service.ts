import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { normalizePhone } from "@/schemas/customer.schema";
import type {
  CustomerFormData,
  CustomerListFilters,
} from "@/schemas/customer.schema";

export async function listCustomers(filters: CustomerListFilters) {
  const where: Prisma.CustomerWhereInput = {};
  if (filters.active === "active") where.active = true;
  else if (filters.active === "inactive") where.active = false;

  if (filters.search && filters.search.trim().length > 0) {
    const searchPhone = normalizePhone(filters.search);
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      ...(searchPhone.length >= 4
        ? [{ phone: { contains: searchPhone } as Prisma.StringFilter }]
        : []),
    ];
  }

  // Filtro por mês de aniversário usa SQL: EXTRACT(MONTH FROM birthday) = N
  if (filters.birthdayMonth) {
    const m = parseInt(filters.birthdayMonth, 10);
    const ids = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Customer"
      WHERE birthday IS NOT NULL
      AND EXTRACT(MONTH FROM birthday) = ${m}
    `;
    where.id = { in: ids.map((r) => r.id) };
  }

  return prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { sales: true } } },
    take: 200,
  });
}

export function getCustomerById(id: string) {
  return prisma.customer.findUnique({ where: { id } });
}

export async function getCustomerWithSales(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { occurredAt: "desc" },
        take: 50,
        select: {
          id: true,
          number: true,
          occurredAt: true,
          status: true,
          progress: true,
          totalRevenue: true,
          couponDiscount: true,
          couponCode: true,
          source: true,
        },
      },
      loyaltyTransactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export function getCustomerByPhone(phone: string) {
  return prisma.customer.findUnique({
    where: { phone: normalizePhone(phone) },
  });
}

export async function createCustomer(input: CustomerFormData) {
  const dup = await prisma.customer.findUnique({
    where: { phone: input.phone },
    select: { id: true, name: true },
  });
  if (dup) {
    throw new BusinessError(
      `Já existe um cliente com esse telefone: ${dup.name}.`,
    );
  }
  return prisma.customer.create({ data: input });
}

export async function updateCustomer(id: string, input: CustomerFormData) {
  const current = await prisma.customer.findUnique({ where: { id } });
  if (!current) throw new BusinessError("Cliente não encontrado.");

  if (current.phone !== input.phone) {
    const dup = await prisma.customer.findUnique({
      where: { phone: input.phone },
      select: { id: true },
    });
    if (dup && dup.id !== id) {
      throw new BusinessError("Já existe um cliente com esse telefone.");
    }
  }

  return prisma.customer.update({ where: { id }, data: input });
}

export async function setCustomerActive(id: string, active: boolean) {
  const c = await prisma.customer.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!c) throw new BusinessError("Cliente não encontrado.");
  return prisma.customer.update({ where: { id }, data: { active } });
}

export async function deleteCustomer(id: string) {
  const count = await prisma.sale.count({ where: { customerId: id } });
  if (count > 0) {
    throw new BusinessError(
      `Este cliente tem ${count} pedido(s) vinculado(s). Inative em vez de excluir.`,
    );
  }
  await prisma.customer.delete({ where: { id } });
}

/**
 * Lista clientes que fazem aniversário no mês indicado (1-12).
 * Default: mês atual.
 */
export async function listBirthdayCustomersOfMonth(month?: number) {
  const m = month ?? new Date().getMonth() + 1;
  const ids = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Customer"
    WHERE birthday IS NOT NULL
    AND active = true
    AND EXTRACT(MONTH FROM birthday) = ${m}
  `;
  if (ids.length === 0) return [];

  return prisma.customer.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    orderBy: { birthday: "asc" },
    include: { _count: { select: { sales: true } } },
  });
}

/**
 * Cria um cupom personalizado de aniversário pra um cliente.
 *  - Código: ANIVER_<NOMEPRIMEIRO>_<MMYY>
 *  - Tipo PERCENT (15% off por padrão), 1 uso, válido até fim do mês.
 *  - Se já existir cupom com mesmo código, retorna o existente.
 */
export async function generateBirthdayCoupon(
  customerId: string,
  options: { percentOff?: number } = {},
) {
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, birthday: true },
  });
  if (!c) throw new BusinessError("Cliente não encontrado.");
  if (!c.birthday) throw new BusinessError("Cliente sem data de aniversário cadastrada.");

  const firstName = c.name.split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z]/g, "") ?? "ANIV";
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear() % 100).padStart(2, "0");
  const code = `ANIVER_${firstName}_${month}${year}`;

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) return existing;

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const percent = options.percentOff ?? 15;

  return prisma.coupon.create({
    data: {
      code,
      description: `Aniversário ${c.name} — ${month}/${year}`,
      type: "PERCENT",
      value: percent,
      maxUses: 1,
      validUntil: lastDay,
      active: true,
    },
  });
}

/**
 * Upsert usado pelo checkout público: dado nome + telefone + endereço,
 * cria o cliente se não existe, ou atualiza endereço/nome se mudaram.
 * Roda dentro da transação que cria a Sale, pra que customerId fique
 * vinculado atomicamente.
 */
export async function upsertCustomerFromCheckout(
  tx: Prisma.TransactionClient,
  input: {
    name: string;
    phone: string;
    address?: string | null;
    addressNumber?: string | null;
    addressComplement?: string | null;
    neighborhood?: string | null;
    reference?: string | null;
  },
): Promise<string> {
  const phone = normalizePhone(input.phone);
  if (phone.length < 8) {
    // Telefone inválido — não vincula a cliente, deixa só o customerName.
    throw new Error(`phone inválido: ${input.phone}`);
  }

  const existing = await tx.customer.findUnique({ where: { phone } });
  if (existing) {
    // Atualiza nome e endereço só se vieram preenchidos no pedido novo —
    // não queremos sobrescrever endereço cadastrado com vazio.
    await tx.customer.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        ...(input.address ? { address: input.address } : {}),
        ...(input.addressNumber ? { addressNumber: input.addressNumber } : {}),
        ...(input.addressComplement
          ? { addressComplement: input.addressComplement }
          : {}),
        ...(input.neighborhood ? { neighborhood: input.neighborhood } : {}),
        ...(input.reference ? { reference: input.reference } : {}),
      },
    });
    return existing.id;
  }

  const created = await tx.customer.create({
    data: {
      name: input.name,
      phone,
      address: input.address ?? null,
      addressNumber: input.addressNumber ?? null,
      addressComplement: input.addressComplement ?? null,
      neighborhood: input.neighborhood ?? null,
      reference: input.reference ?? null,
    },
  });
  return created.id;
}
