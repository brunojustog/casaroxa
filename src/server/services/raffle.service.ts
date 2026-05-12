/**
 * Sorteios / rifas.
 *
 * Modelo de operação:
 *   - ADMIN cria Raffle com nome, prêmio (descritivo), opensAt, closesAt.
 *   - Status: DRAFT → OPEN (cliente já consegue entrar) → CLOSED →
 *     DRAWN (sorteado).
 *   - Cliente identificado (via OTP) clica "Participar". 1 entrada por
 *     pessoa, com número sequencial (1, 2, 3...) que serve pra
 *     sortear via Math.floor(Math.random() * total) + 1.
 *   - ADMIN clica "Sortear" na data; sistema escolhe entry aleatória,
 *     marca winnerEntryId, status=DRAWN, e dispara WhatsApp pro ganhador
 *     com o prêmio descritivo (entrega manual depois).
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
      // Admin vê total de inscritos confirmados (não conta pendentes de pagamento)
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

/** Lista pública (sem expor dados dos inscritos). */
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
      _count: { select: { entries: { where: { confirmed: true } } } },
    },
  });
}

/** Dados públicos de UM sorteio (sem listar inscritos). */
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

/** Sorteios em que o cliente entrou (pra /meus-pedidos) — só confirmados. */
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
  // Mudar preço depois que já tem inscritos é injusto — trava.
  if (
    current._count.entries > 0 &&
    current.ticketPriceCents !== input.ticketPriceCents
  ) {
    throw new BusinessError(
      "Já existem inscritos — não dá pra mudar o preço do ticket. Cancele e crie um novo sorteio.",
    );
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
    throw new BusinessError("Sorteio já realizado — não pode ser excluído. Use CANCELLED.");
  }
  if (r._count.entries > 0) {
    throw new BusinessError(
      `Este sorteio já tem ${r._count.entries} inscrito(s). Marque como cancelado em vez de excluir.`,
    );
  }
  await prisma.raffle.delete({ where: { id } });
}

// ---------- Inscrição (público, via OTP) ----------

export type EnterRaffleResult =
  | { ok: true; number: number; alreadyEntered: false }
  | { ok: true; number: number; alreadyEntered: true }
  | { ok: false; error: string };

export async function enterRaffle(
  raffleId: string,
  customerId: string,
): Promise<EnterRaffleResult> {
  const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } });
  if (!raffle) return { ok: false, error: "Sorteio não encontrado." };
  if (raffle.status !== RaffleStatus.OPEN) {
    return { ok: false, error: "Este sorteio não está aceitando inscrições." };
  }
  if (raffle.ticketPriceCents > 0) {
    return {
      ok: false,
      error: "Este sorteio é pago — use o fluxo de compra com PIX.",
    };
  }
  const now = new Date();
  if (raffle.opensAt > now) {
    return { ok: false, error: "Sorteio ainda não abriu pra inscrições." };
  }
  if (raffle.closesAt < now) {
    return { ok: false, error: "Inscrições já encerraram." };
  }

  // Idempotente: se cliente já entrou, retorna o número da entrada existente.
  const existing = await prisma.raffleEntry.findUnique({
    where: { raffleId_customerId: { raffleId, customerId } },
  });
  if (existing) {
    return { ok: true, number: existing.number, alreadyEntered: true };
  }

  // Transação: count + create. Race-condition entre count e create é
  // protegido pela @@unique(raffleId, number) — se 2 inserts simultâneos
  // pegarem o mesmo "next", o segundo falha e retry pega next+1. Aqui só
  // tento até 3 vezes (suficiente pra concurrency razoável).
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const total = await prisma.raffleEntry.count({ where: { raffleId } });
      const entry = await prisma.raffleEntry.create({
        data: {
          raffleId,
          customerId,
          number: total + 1,
        },
      });
      return { ok: true, number: entry.number, alreadyEntered: false };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        // Conflito de número OU de (raffleId, customerId) — re-verifica o
        // 2º caso (cliente entrou em paralelo) e desiste; senão tenta de novo.
        const existingNow = await prisma.raffleEntry.findUnique({
          where: { raffleId_customerId: { raffleId, customerId } },
        });
        if (existingNow) {
          return {
            ok: true,
            number: existingNow.number,
            alreadyEntered: true,
          };
        }
        continue;
      }
      throw e;
    }
  }
  return { ok: false, error: "Tente de novo em alguns segundos." };
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
      throw new BusinessError("Nenhum inscrito confirmado ainda. Não dá pra sortear vazio.");
    }

    // Sorteio uniforme entre as entries confirmadas. Como números podem ter
    // "buracos" (entry paga que expirou foi deletada), pego em ordem e indexo.
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

  // Fora da transação: dispara WhatsApp pro ganhador. Bypass dos toggles
  // (notificação de prêmio é parte do produto, não opcional). Se a config
  // de WhatsApp tiver desligada, vai logar como SKIPPED e admin é quem
  // contata na mão.
  const message = `🎉 *Parabéns, ${result.customerName}!*\n\nVocê é o ganhador do sorteio *${result.raffleName}* da Casa Roxa!\n\n${result.prizeDescription ? `🎁 Prêmio: ${result.prizeDescription}\n\n` : ""}Em breve entraremos em contato pra combinar a entrega.`;

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

// ---------- Compra de ticket (rifa paga via PIX) ----------

/**
 * Reserva uma entry pendente pra cliente comprar via PIX. Idempotente —
 * se cliente já tem entry pendente nessa rifa, retorna a mesma. Se já tem
 * entry confirmada, lança BusinessError.
 *
 * Retorna o `raffleEntryId` — quem chama (route handler) usa ele junto a
 * `initiateOnlinePayment({ raffleEntryId })` pra criar/recuperar o
 * OnlinePayment do Asaas.
 */
export async function reserveRaffleEntryForPurchase(
  raffleId: string,
  customerId: string,
): Promise<{ raffleEntryId: string; ticketPriceCents: number; raffleName: string }> {
  const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } });
  if (!raffle) throw new BusinessError("Sorteio não encontrado.");
  if (raffle.status !== RaffleStatus.OPEN) {
    throw new BusinessError("Este sorteio não está aceitando inscrições.");
  }
  if (raffle.ticketPriceCents <= 0) {
    throw new BusinessError("Este sorteio é gratuito — use a inscrição normal.");
  }
  const now = new Date();
  if (raffle.opensAt > now) {
    throw new BusinessError("Sorteio ainda não abriu pra inscrições.");
  }
  if (raffle.closesAt < now) {
    throw new BusinessError("Inscrições já encerraram.");
  }

  // Já tem entry? Pode ser confirmada (erro) ou pendente (idempotente).
  const existing = await prisma.raffleEntry.findUnique({
    where: { raffleId_customerId: { raffleId, customerId } },
  });
  if (existing) {
    if (existing.confirmed) {
      throw new BusinessError("Você já está participando deste sorteio.");
    }
    return {
      raffleEntryId: existing.id,
      ticketPriceCents: raffle.ticketPriceCents,
      raffleName: raffle.name,
    };
  }

  // Cria entry pendente com número sequencial. Mesma estratégia de retry
  // contra race-condition em (raffleId, number).
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const total = await prisma.raffleEntry.count({ where: { raffleId } });
      const entry = await prisma.raffleEntry.create({
        data: {
          raffleId,
          customerId,
          number: total + 1,
          confirmed: false,
        },
      });
      return {
        raffleEntryId: entry.id,
        ticketPriceCents: raffle.ticketPriceCents,
        raffleName: raffle.name,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const existingNow = await prisma.raffleEntry.findUnique({
          where: { raffleId_customerId: { raffleId, customerId } },
        });
        if (existingNow) {
          if (existingNow.confirmed) {
            throw new BusinessError("Você já está participando deste sorteio.");
          }
          return {
            raffleEntryId: existingNow.id,
            ticketPriceCents: raffle.ticketPriceCents,
            raffleName: raffle.name,
          };
        }
        continue;
      }
      throw e;
    }
  }
  throw new BusinessError("Tente de novo em alguns segundos.");
}

/**
 * Chamada pelo webhook quando o OnlinePayment de uma entry confirma.
 * Marca a entry como confirmada e dispara WhatsApp com o número.
 */
export async function confirmRaffleEntryFromPayment(raffleEntryId: string) {
  const entry = await prisma.raffleEntry.findUnique({
    where: { id: raffleEntryId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      raffle: { select: { id: true, name: true, prizeDescription: true } },
    },
  });
  if (!entry) return;
  if (entry.confirmed) return; // idempotente

  await prisma.raffleEntry.update({
    where: { id: entry.id },
    data: { confirmed: true },
  });

  const message = `🎟️ *Você está no sorteio!*\n\nSorteio: *${entry.raffle.name}*${entry.raffle.prizeDescription ? `\nPrêmio: ${entry.raffle.prizeDescription}` : ""}\n\nSeu número da sorte: *${entry.number}*\n\nBoa sorte! 🍀`;
  sendText({
    phone: entry.customer.phone,
    message,
    event: "RAFFLE_WIN",
    bypassToggles: true,
    customerId: entry.customer.id,
  }).catch((e) => console.error("[confirmRaffleEntryFromPayment] whatsapp:", e));
}

/** Pagamento expirou/cancelou — libera a entry pendente. */
export async function releasePendingRaffleEntry(raffleEntryId: string) {
  const entry = await prisma.raffleEntry.findUnique({
    where: { id: raffleEntryId },
  });
  if (!entry || entry.confirmed) return;
  await prisma.raffleEntry.delete({ where: { id: entry.id } });
}
