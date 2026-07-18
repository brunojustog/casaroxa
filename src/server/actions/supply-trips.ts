"use server";

import { revalidatePath } from "next/cache";
import { supplyTripFormSchema } from "@/schemas/supply-trip.schema";
import {
  createSupplyTrip,
  deleteSupplyTrip,
  setSupplyTripStatus,
  updateSupplyTrip,
} from "@/server/services/supply-trip.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidateTrips() {
  revalidatePath("/viagens");
  revalidatePath("/emporio");
  revalidatePath("/emporio/encomenda");
}

export async function createSupplyTripAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = supplyTripFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const trip = await createSupplyTrip(parsed.data);
    return { id: trip.id };
  });
  if (result.ok) revalidateTrips();
  return result;
}

export async function updateSupplyTripAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = supplyTripFormSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(parsed.error.errors[0]?.message ?? "Dados inválidos");
    }
    const trip = await updateSupplyTrip(id, parsed.data);
    return { id: trip.id };
  });
  if (result.ok) revalidateTrips();
  return result;
}

export async function setSupplyTripStatusAction(
  id: string,
  status: "AGENDADA" | "CONCLUIDA" | "CANCELADA",
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await setSupplyTripStatus(id, status);
  });
  if (result.ok) revalidateTrips();
  return result;
}

export async function deleteSupplyTripAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await deleteSupplyTrip(id);
  });
  if (result.ok) revalidateTrips();
  return result;
}
