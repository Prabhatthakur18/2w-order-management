"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { isEditable, placeOrder } from "@/lib/order-lifecycle";

const idSchema = z.string().min(1).max(64);

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** Places an order early, before its edit window expires. */
export async function placeOrderNow(orderId: string): Promise<ActionResult> {
  const session = await requireRole(["ASM", "ADMIN"]);
  const parsed = idSchema.safeParse(orderId);
  if (!parsed.success) return { ok: false, error: "Invalid order." };

  const isAdmin = session.user.roles.includes("ADMIN");
  const order = await db.order.findFirst({
    // An ASM can only place their own orders.
    where: isAdmin
      ? { id: parsed.data }
      : { id: parsed.data, createdById: session.user.id },
    select: { id: true, status: true },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "CREATED") {
    return { ok: false, error: "This order has already been placed." };
  }

  const result = await placeOrder(order.id, session.user.id, false);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/asm/orders");
  revalidatePath(`/asm/orders/${order.id}`);
  return { ok: true, message: `Order placed. PI ${result.piNumber}` };
}

/** Cancels an order while it is still within the edit window. */
export async function cancelOrder(orderId: string): Promise<ActionResult> {
  const session = await requireRole(["ASM", "ADMIN"]);
  const parsed = idSchema.safeParse(orderId);
  if (!parsed.success) return { ok: false, error: "Invalid order." };

  const isAdmin = session.user.roles.includes("ADMIN");
  const order = await db.order.findFirst({
    where: isAdmin
      ? { id: parsed.data }
      : { id: parsed.data, createdById: session.user.id },
    select: { id: true, status: true, editableUntil: true },
  });
  if (!order) return { ok: false, error: "Order not found." };

  if (!isEditable(order)) {
    return {
      ok: false,
      error: "The edit window has closed; this order can no longer be cancelled.",
    };
  }

  // Guard inside the where clause so a concurrent sweep cannot race this.
  const updated = await db.order.updateMany({
    where: { id: order.id, status: "CREATED" },
    data: { status: "CANCELLED" },
  });
  if (updated.count === 0) {
    return { ok: false, error: "This order is no longer pending." };
  }

  await db.auditLog.create({
    data: {
      entityType: "Order",
      entityId: order.id,
      action: "CANCELLED",
      toValue: { status: "CANCELLED" },
      actorId: session.user.id,
    },
  });

  revalidatePath("/asm/orders");
  revalidatePath(`/asm/orders/${order.id}`);
  return { ok: true, message: "Order cancelled." };
}
