"use server";

import { revalidatePath } from "next/cache";
import { RaffleStatus } from "@prisma/client";
import { raffleFormSchema } from "@/schemas/raffle.schema";
import {
  createRaffle,
  deleteRaffle,
  drawNextPrize,
  setRaffleStatus,
  updateRaffle,
} from "@/server/services/raffle.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateRaffles(id?: string) {
  revalidatePath("/sorteios");
  if (id) revalidatePath(`/sorteios/${id}`);
  // Página pública também
  revalidatePath("/sorteios");
}

export async function createRaffleAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = raffleFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const r = await createRaffle(parsed.data);
    return { id: r.id };
  });
  if (result.ok) revalidateRaffles(result.data?.id);
  return result;
}

export async function updateRaffleAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = raffleFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const r = await updateRaffle(id, parsed.data);
    return { id: r.id };
  });
  if (result.ok) revalidateRaffles(id);
  return result;
}

export async function setRaffleStatusAction(
  id: string,
  status: RaffleStatus,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await setRaffleStatus(id, status);
  });
  if (result.ok) revalidateRaffles(id);
  return result;
}

export async function deleteRaffleAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await deleteRaffle(id);
  });
  if (result.ok) revalidateRaffles();
  return result;
}

export async function drawNextPrizeAction(
  id: string,
): Promise<
  ActionResult<{
    prizePosition: number;
    prizeDescription: string;
    winnerNumber: number;
    customerName: string;
    customerPhone: string;
    isFinalPrize: boolean;
  }>
> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    const r = await drawNextPrize(id, user.id);
    return {
      prizePosition: r.prizePosition,
      prizeDescription: r.prizeDescription,
      winnerNumber: r.winnerNumber,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      isFinalPrize: r.isFinalPrize,
    };
  });
  if (result.ok) revalidateRaffles(id);
  return result;
}
