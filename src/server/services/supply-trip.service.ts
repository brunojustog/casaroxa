/**
 * Viagens de compra do empório (ida a Minas, ~2x/mês).
 *
 * O cliente encomenda itens do empório escolhendo uma viagem AGENDADA cujo
 * cutoffAt ainda não passou. Admin agenda/conclui/cancela em /viagens.
 */
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";
import type { SupplyTripFormData } from "@/schemas/supply-trip.schema";

/** Próximas viagens abertas pra encomenda (site público). */
export async function listOpenSupplyTrips(limit = 3) {
  return prisma.supplyTrip.findMany({
    where: { status: "AGENDADA", cutoffAt: { gt: new Date() } },
    orderBy: { tripDate: "asc" },
    take: limit,
    select: { id: true, tripDate: true, cutoffAt: true, notes: true },
  });
}

/** Listagem completa pro admin (futuras primeiro, histórico depois). */
export async function listSupplyTrips() {
  return prisma.supplyTrip.findMany({
    orderBy: [{ tripDate: "desc" }],
    include: { _count: { select: { orderRequests: true } } },
  });
}

export async function createSupplyTrip(data: SupplyTripFormData) {
  return prisma.supplyTrip.create({
    data: {
      tripDate: data.tripDate,
      cutoffAt: data.cutoffAt,
      notes: data.notes,
    },
  });
}

export async function updateSupplyTrip(id: string, data: SupplyTripFormData) {
  const trip = await prisma.supplyTrip.findUnique({ where: { id } });
  if (!trip) throw new BusinessError("Viagem não encontrada.");
  return prisma.supplyTrip.update({
    where: { id },
    data: {
      tripDate: data.tripDate,
      cutoffAt: data.cutoffAt,
      notes: data.notes,
    },
  });
}

export async function setSupplyTripStatus(
  id: string,
  status: "AGENDADA" | "CONCLUIDA" | "CANCELADA",
) {
  const trip = await prisma.supplyTrip.findUnique({
    where: { id },
    include: { _count: { select: { orderRequests: true } } },
  });
  if (!trip) throw new BusinessError("Viagem não encontrada.");
  if (status === "CANCELADA" && trip._count.orderRequests > 0) {
    // Cancelar viagem NÃO cancela as encomendas — o admin resolve uma a uma
    // (remarcar pra outra viagem ou recusar). Só avisa via erro se esquecer.
    const pendentes = await prisma.orderRequest.count({
      where: {
        supplyTripId: id,
        status: { in: ["PENDENTE", "APROVADA", "EM_PRODUCAO"] },
      },
    });
    if (pendentes > 0) {
      throw new BusinessError(
        `Esta viagem tem ${pendentes} encomenda(s) em aberto. Resolva-as antes de cancelar (recuse ou mova pra outra viagem em Encomendas).`,
      );
    }
  }
  return prisma.supplyTrip.update({ where: { id }, data: { status } });
}

export async function deleteSupplyTrip(id: string) {
  const count = await prisma.orderRequest.count({ where: { supplyTripId: id } });
  if (count > 0) {
    throw new BusinessError(
      "Viagem tem encomendas vinculadas — cancele em vez de excluir.",
    );
  }
  await prisma.supplyTrip.delete({ where: { id } });
}
