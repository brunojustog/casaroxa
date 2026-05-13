"use server";

import { revalidatePath } from "next/cache";
import { SalesEventStatus } from "@prisma/client";
import { salesEventFormSchema } from "@/schemas/sales-event.schema";
import {
  createSalesEvent,
  deleteSalesEvent,
  duplicateSalesEventNextWeek,
  setSalesEventStatus,
  updateSalesEvent,
  cleanupExpiredReservations,
} from "@/server/services/sales-event.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidate(id?: string) {
  revalidatePath("/pre-vendas");
  if (id) revalidatePath(`/pre-vendas/${id}`);
  revalidatePath("/cardapio");
  revalidatePath("/pre-venda");
}

export async function createSalesEventAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    const parsed = salesEventFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const e = await createSalesEvent(parsed.data, user.id);
    return { id: e.id };
  });
  if (result.ok) revalidate(result.data?.id);
  return result;
}

export async function updateSalesEventAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = salesEventFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const e = await updateSalesEvent(id, parsed.data);
    return { id: e.id };
  });
  if (result.ok) revalidate(id);
  return result;
}

export async function setSalesEventStatusAction(
  id: string,
  status: SalesEventStatus,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await setSalesEventStatus(id, status);
  });
  if (result.ok) revalidate(id);
  return result;
}

export async function duplicateSalesEventNextWeekAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    return await duplicateSalesEventNextWeek(id, user.id);
  });
  if (result.ok) revalidate(result.data?.id);
  return result;
}

export async function deleteSalesEventAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await deleteSalesEvent(id);
  });
  if (result.ok) revalidate();
  return result;
}

/** Manualmente dispara a limpeza de reservas expiradas. Job roda via cron. */
export async function cleanupExpiredReservationsAction(): Promise<
  ActionResult<{ released: number }>
> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const released = await cleanupExpiredReservations();
    return { released };
  });
  if (result.ok) revalidate();
  return result;
}
