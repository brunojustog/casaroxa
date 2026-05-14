"use server";

import { revalidatePath } from "next/cache";
import { OrderRequestStatus } from "@prisma/client";
import {
  adminOrderRequestSchema,
  approveOrderRequestSchema,
  rejectOrderRequestSchema,
} from "@/schemas/order-request.schema";
import {
  approveOrderRequest,
  createAdminOrderRequest,
  markDepositPaid,
  rejectOrderRequest,
  setOrderRequestStatus,
} from "@/server/services/order-request.service";
import {
  BusinessError,
  requireRole,
  runAction,
  type ActionResult,
} from "@/server/auth-helpers";

function revalidate(id?: string) {
  revalidatePath("/encomendas");
  if (id) revalidatePath(`/encomendas/${id}`);
}

export async function createAdminOrderRequestAction(
  raw: unknown,
): Promise<ActionResult<{ id: string; number: number }>> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    const parsed = adminOrderRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const path = first?.path.join(".");
      throw new BusinessError(
        path
          ? `${path}: ${first.message}`
          : (first?.message ?? "Dados inválidos"),
      );
    }
    return await createAdminOrderRequest(parsed.data, user.id);
  });
  if (result.ok) revalidate(result.data?.id);
  return result;
}

export async function approveOrderRequestAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; saleId: string | null }>> {
  const result = await runAction(async () => {
    const user = await requireRole("ADMIN");
    const parsed = approveOrderRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(
        parsed.error.errors[0]?.message ?? "Dados inválidos",
      );
    }
    return await approveOrderRequest(id, parsed.data, user.id);
  });
  if (result.ok) revalidate(id);
  return result;
}

export async function rejectOrderRequestAction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    const parsed = rejectOrderRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BusinessError(
        parsed.error.errors[0]?.message ?? "Dados inválidos",
      );
    }
    await rejectOrderRequest(id, parsed.data);
  });
  if (result.ok) revalidate(id);
  return result;
}

export async function setOrderRequestStatusAction(
  id: string,
  next: OrderRequestStatus,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await setOrderRequestStatus(id, next);
  });
  if (result.ok) revalidate(id);
  return result;
}

export async function markDepositPaidAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole("ADMIN");
    await markDepositPaid(id);
  });
  if (result.ok) revalidate(id);
  return result;
}
