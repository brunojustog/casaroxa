/**
 * Sorteios / rifas (modelo de rifa com pool fechado de números).
 *
 * Como funciona:
 *   - ADMIN cria Raffle com: nome, prêmio, opensAt, closesAt, totalNumbers
 *     (ex.: 100), ticketPriceCents (0=grátis | >0=paga PIX) e
 *     maxTicketsPerCustomer (null=sem limite).
 *   - Cliente identificado (via OTP) escolhe N números livres na grade
 *     (1..totalNumbers). Pagamento:
 *       grátis: confirma direto (cria N RaffleEntries com confirmed=true)
 *       paga:   reserva (confirmed=false) + cria 1 OnlinePayment com o
 *               valor = N × ticketPriceCents, e quando webhook confirma
 *               marca as N entries como confirmed=true.
 *   - Sorteio (manual no admin): escolhe entre RaffleEntries confirmadas.
 *     Animação cliente-side; servidor já sabe o vencedor.
 */
import { Prisma, RaffleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import { sendText } from "./whatsapp.service";
import type {
  RaffleFormData,
  RaffleListFilters,
} from "@/schemas/raffle.schema";

// ---------- Listagem / leitura ----------

export async function listRaffles(filters: RaffleListFilters) {
  const where: Prisma.RaffleWhereInput = {};
  if (filters.status !== "all") where.status = filters.status;

  return prisma.raffle.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { entries: { where: { confirmed: true } } } },
      winnerEntry: {
        include: { customer: { select: { id: true, name: true, phone: true } } },
      },
    },
  });
}

export async function getRaffleById(id: string) {
  return prisma.raffle.findUnique({
    where: { id },
    include: {
      _count: { select: { entries: { where: { confirmed: true } } } },
      entries: {
        where: { confirmed: true },
        orderBy: { number: "asc" },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
        },
      },
      winnerEntry: {
        include: { customer: { select: { id: true, name: true, phone: true } } },
      },
    },
  });
}

export async function listOpenRaffles() {
  const now = new Date();
  return prisma.raffle.findMany({
    where: {
      status: RaffleStatus.OPEN,
      opensAt: { lte: now },
      closesAt: { gte: now },
    },
    orderBy: { closesAt: "asc" },
    select: {
      id: true,
      name: true,
      prizeDescription: true,
      imageUrl: true,
      opensAt: true,
      closesAt: true,
      drawAt: true,
      ticketPriceCents: true,
      totalNumbers: true,
      _count: { select: { entries: { where: { confirmed: true } } } },
    },
  });
}

export async function getRaffleForPublic(id: string) {
  return prisma.raffle.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      prizeDescription: true,
      imageUrl: true,
      opensAt: true,
      closesAt: true,
      drawAt: true,
      status: true,
      drawnAt: true,
      ticketPriceCents: true,
      totalNumbers: true,
      maxTicketsPerCustomer: true,
      _count: { select: { entries: { where: { confirmed: true } } } },
      winnerEntry: {
        select: {
          number: true,
          customer: { select: { name: true } },
        },
      },
    },
  });
}

/**
 * Estado da grade pública: lista todos os números 1..totalNumbers com:
 *   - taken: Set dos números já vendidos/reservados (ambos: confirmed=true
 *     e confirmed=false enquanto não expira o payment)
 *   - mine: Set dos números do próprio cliente (se logado)
 */
export async function getRaffleNumbersState(
  raffleId: string,
  customerId: string | null,
) {
  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    select: { totalNumbers: true },
  });
  if (!raffle) throw new BusinessError("Sorteio não encontrado.");

  const entries = await prisma.raffleEntry.findMany({
    where: { raffleId },
    select: { number: true, customerId: true, confirmed: true },
  });

  const taken = new Set<number>();
  const mine = new Set<number>();
  const minePending = new Set<number>();
  for (const e of entries) {
    taken.add(e.number);
    if (customerId && e.customerId === customerId) {
      mine.add(e.number);
      if (!e.confirmed) minePending.add(e.number);
    }
  }
  return {
    totalNumbers: raffle.totalNumbers,
    taken: Array.from(taken),
    mine: Array.from(mine),
    minePending: Array.from(minePending),
  };
}

export async function listRafflesForCustomer(customerId: string) {
  return prisma.raffleEntry.findMany({
    where: { customerId, confirmed: true },
    orderBy: { createdAt: "desc" },
    include: {
      raffle: {
        select: {
          id: true,
          name: true,
          prizeDescription: true,
          status: true,
          closesAt: true,
          drawAt: true,
          drawnAt: true,
          winnerEntryId: true,
        },
      },
    },
  });
}

// ---------- CRUD admin ----------

export async function createRaffle(input: RaffleFormData) {
  return prisma.raffle.create({
    data: {
      name: input.name,
      prizeDescription: input.prizeDescription,
      imageUrl: input.imageUrl,
      opensAt: input.opensAt,
      closesAt: input.closesAt,
      drawAt: input.drawAt,
      ticketPriceCents: input.ticketPriceCents,
      totalNumbers: input.totalNumbers,
      maxTicketsPerCustomer: input.maxTicketsPerCustomer,
      status: input.status,
    },
  });
}

export async function updateRaffle(id: string, input: RaffleFormData) {
  const current = await prisma.raffle.findUnique({
    where: { id },
    include: { _count: { select: { entries: true } } },
  });
  if (!current) throw new BusinessError("Sorteio não encontrado.");
  if (current.status === "DRAWN") {
    throw new BusinessError("Sorteio já realizado — não pode ser editado.");
  }
  if (current.status === "CANCELLED") {
    throw new BusinessError("Sorteio cancelado.");
  }
  // Mudar preço/total/limite depois de ter inscritos é injusto.
  if (current._count.entries > 0) {
    if (current.ticketPriceCents !== input.ticketPriceCents) {
      throw new BusinessError(
        "Já há inscritos — não dá pra mudar o preço. Cancele e crie uma nova rifa.",
      );
    }
    if (current.totalNumbers !== input.totalNumbers) {
      throw new BusinessError(
        "Já há inscritos — não dá pra mudar o total de números.",
      );
    }
  }
  return prisma.raffle.update({
    where: { id },
    data: {
      name: input.name,
      prizeDescription: input.prizeDescription,
      imageUrl: input.imageUrl,
      opensAt: input.opensAt,
      closesAt: input.closesAt,
      drawAt: input.drawAt,
      ticketPriceCents: input.ticketPriceCents,
      totalNumbers: input.totalNumbers,
      maxTicketsPerCustomer: input.maxTicketsPerCustomer,
      status: input.status,
    },
  });
}

export async function setRaffleStatus(id: string, status: RaffleStatus) {
  const current = await prisma.raffle.findUnique({ where: { id } });
  if (!current) throw new BusinessError("Sorteio não encontrado.");
  if (current.status === "DRAWN" && status !== "DRAWN") {
    throw new BusinessError("Sorteio já realizado — só pode permanecer DRAWN.");
  }
  return prisma.raffle.update({ where: { id }, data: { status } });
}

export async function deleteRaffle(id: string) {
  const r = await prisma.raffle.findUnique({
    where: { id },
    select: { _count: { select: { entries: true } }, status: true },
  });
  if (!r) throw new BusinessError("Sorteio não encontrado.");
  if (r.status === "DRAWN") {
    throw new BusinessError("Sorteio já realizado — não pode ser excluído.");
  }
  if (r._count.entries > 0) {
    throw new BusinessError(
      `Este sorteio já tem ${r._count.entries} inscrito(s). Cancele em vez de excluir.`,
    );
  }
  await prisma.raffle.delete({ where: { id } });
}

// ---------- Reserva / confirmação ----------

/**
 * Pré-checa antes de criar entries. Validações comuns a grátis e paga:
 *  - rifa OPEN dentro da janela
 *  - todos os números no range 1..totalNumbers
 *  - nenhum dos números já tomado
 *  - cliente respeitando maxTicketsPerCustomer
 */
async function validatePurchase(
  raffleId: string,
  customerId: string,
  numbers: number[],
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ raffleName: string; ticketPriceCents: number }> {
  if (numbers.length === 0) {
    throw new BusinessError("Escolha pelo menos 1 número.");
  }
  const uniq = new Set(numbers);
  if (uniq.size !== numbers.length) {
    throw new BusinessError("Lista de números tem duplicatas.");
  }

  const raffle = await tx.raffle.findUnique({
    where: { id: raffleId },
  });
  if (!raffle) throw new BusinessError("Sorteio não encontrado.");
  if (raffle.status !== RaffleStatus.OPEN) {
    throw new BusinessError("Este sorteio não está aceitando inscrições.");
  }
  const now = new Date();
  if (raffle.opensAt > now) {
    throw new BusinessError("Sorteio ainda não abriu pra inscrições.");
  }
  if (raffle.closesAt < now) {
    throw new BusinessError("Inscrições já encerraram.");
  }

  for (const n of numbers) {
    if (!Number.isInteger(n) || n < 1 || n > raffle.totalNumbers) {
      throw new BusinessError(
        `Número ${n} fora do intervalo (1..${raffle.totalNumbers}).`,
      );
    }
  }

  const taken = await tx.raffleEntry.findMany({
    where: { raffleId, number: { in: numbers } },
    select: { number: true },
  });
  if (taken.length > 0) {
    const list = taken.map((t) => t.number).join(", ");
    throw new BusinessError(`Números já vendidos: ${list}.`);
  }

  if (raffle.maxTicketsPerCustomer !== null) {
    const mine = await tx.raffleEntry.count({
      where: { raffleId, customerId },
    });
    if (mine + numbers.length > raffle.maxTicketsPerCustomer) {
      throw new BusinessError(
        `Limite de ${raffle.maxTicketsPerCustomer} número(s) por cliente.`,
      );
    }
  }

  return {
    raffleName: raffle.name,
    ticketPriceCents: raffle.ticketPriceCents,
  };
}

/**
 * Reserva N números pra cliente comprar (rifa paga). Cria N RaffleEntries
 * com confirmed=false dentro de uma transação. Retorna IDs pra quem chamar
 * criar o OnlinePayment vinculado.
 */
export async function reserveRaffleNumbersForPurchase(
  raffleId: string,
  customerId: string,
  numbers: number[],
): Promise<{
  entryIds: string[];
  numbers: number[];
  totalCents: number;
  raffleName: string;
}> {
  return prisma.$transaction(async (tx) => {
    const { raffleName, ticketPriceCents } = await validatePurchase(
      raffleId,
      customerId,
      numbers,
      tx,
    );
    if (ticketPriceCents <= 0) {
      throw new BusinessError(
        "Este sorteio é gratuito — use a inscrição normal.",
      );
    }

    const entries = await Promise.all(
      numbers.map((number) =>
        tx.raffleEntry.create({
          data: {
            raffleId,
            customerId,
            number,
            confirmed: false,
          },
        }),
      ),
    );

    return {
      entryIds: entries.map((e) => e.id),
      numbers: entries.map((e) => e.number),
      totalCents: ticketPriceCents * numbers.length,
      raffleName,
    };
  });
}

/**
 * Inscrição gratuita: cria N entries confirmadas direto (rifa gratuita).
 */
export async function enterRaffleFree(
  raffleId: string,
  customerId: string,
  numbers: number[],
): Promise<{ entries: { id: string; number: number }[]; raffleName: string }> {
  return prisma.$transaction(async (tx) => {
    const { raffleName, ticketPriceCents } = await validatePurchase(
      raffleId,
      customerId,
      numbers,
      tx,
    );
    if (ticketPriceCents > 0) {
      throw new BusinessError(
        "Este sorteio é pago — use o fluxo de compra com PIX.",
      );
    }

    const created = await Promise.all(
      numbers.map((number) =>
        tx.raffleEntry.create({
          data: {
            raffleId,
            customerId,
            number,
            confirmed: true,
          },
        }),
      ),
    );

    return {
      entries: created.map((e) => ({ id: e.id, number: e.number })),
      raffleName,
    };
  });
}

/**
 * Chamada pelo webhook quando o OnlinePayment de uma "cesta" de números
 * confirma. Marca todas as entries vinculadas como confirmed=true e dispara
 * WhatsApp com a lista de números.
 */
export async function confirmRaffleEntriesFromPayment(paymentId: string) {
  const payment = await prisma.onlinePayment.findUnique({
    where: { id: paymentId },
    include: {
      raffleEntries: {
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          raffle: { select: { id: true, name: true, prizeDescription: true } },
        },
      },
    },
  });
  if (!payment) return;
  const pending = payment.raffleEntries.filter((e) => !e.confirmed);
  if (pending.length === 0) return;

  await prisma.raffleEntry.updateMany({
    where: { onlinePaymentId: payment.id, confirmed: false },
    data: { confirmed: true },
  });

  const first = pending[0];
  const customer = first.customer;
  const raffle = first.raffle;
  const numbers = pending
    .map((e) => e.number)
    .sort((a, b) => a - b)
    .join(", ");
  const message = `🎟️ *Você está no sorteio!*\n\nSorteio: *${raffle.name}*${raffle.prizeDescription ? `\nPrêmio: ${raffle.prizeDescription}` : ""}\n\nSeus números da sorte: *${numbers}*\n\nVer comprovante: https://casaroxa.com.br/sorteio/${raffle.id}/comprovante/${payment.id}\n\nBoa sorte! 🍀`;
  sendText({
    phone: customer.phone,
    message,
    event: "RAFFLE_WIN",
    bypassToggles: true,
    customerId: customer.id,
  }).catch((e) =>
    console.error("[confirmRaffleEntriesFromPayment] whatsapp:", e),
  );
}

/**
 * Pagamento expirou/cancelou — libera os números pendentes.
 */
export async function releasePendingRaffleEntries(paymentId: string) {
  await prisma.raffleEntry.deleteMany({
    where: { onlinePaymentId: paymentId, confirmed: false },
  });
}

// ---------- Sortear ----------

export type DrawRaffleResult = {
  winnerEntryId: string;
  winnerNumber: number;
  customerName: string;
  customerPhone: string;
};

export async function drawRaffle(
  raffleId: string,
  drawnByUserId: string,
): Promise<DrawRaffleResult> {
  const result = await prisma.$transaction(async (tx) => {
    const raffle = await tx.raffle.findUnique({
      where: { id: raffleId },
      include: {
        _count: { select: { entries: { where: { confirmed: true } } } },
      },
    });
    if (!raffle) throw new BusinessError("Sorteio não encontrado.");
    if (raffle.status === "DRAWN") {
      throw new BusinessError("Sorteio já foi realizado.");
    }
    if (raffle.status === "CANCELLED") {
      throw new BusinessError("Sorteio cancelado — não pode sortear.");
    }
    if (raffle._count.entries === 0) {
      throw new BusinessError(
        "Nenhum inscrito confirmado ainda. Não dá pra sortear vazio.",
      );
    }

    const confirmedEntries = await tx.raffleEntry.findMany({
      where: { raffleId, confirmed: true },
      orderBy: { number: "asc" },
      include: { customer: { select: { id: true, name: true, phone: true } } },
    });
    const winnerIdx = Math.floor(Math.random() * confirmedEntries.length);
    const winnerEntry = confirmedEntries[winnerIdx];
    if (!winnerEntry) {
      throw new BusinessError("Falha ao localizar entry sorteada.");
    }

    await tx.raffle.update({
      where: { id: raffleId },
      data: {
        status: "DRAWN",
        winnerEntryId: winnerEntry.id,
        drawnAt: new Date(),
        drawnById: drawnByUserId,
      },
    });

    return {
      winnerEntryId: winnerEntry.id,
      winnerNumber: winnerEntry.number,
      customerName: winnerEntry.customer.name,
      customerPhone: winnerEntry.customer.phone,
      raffleName: raffle.name,
      prizeDescription: raffle.prizeDescription,
    };
  });

  const message = `🎉 *Parabéns, ${result.customerName}!*\n\nVocê é o ganhador do sorteio *${result.raffleName}* da Casa Roxa!\n\nNúmero sorteado: *${result.winnerNumber}*${result.prizeDescription ? `\n\n🎁 Prêmio: ${result.prizeDescription}` : ""}\n\nEm breve entraremos em contato pra combinar a entrega.`;

  sendText({
    phone: result.customerPhone,
    message,
    event: "RAFFLE_WIN",
    bypassToggles: true,
    customerId: undefined,
  }).catch((e) => console.error("[drawRaffle] whatsapp:", e));

  return {
    winnerEntryId: result.winnerEntryId,
    winnerNumber: result.winnerNumber,
    customerName: result.customerName,
    customerPhone: result.customerPhone,
  };
}
