"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { deleteStoredFile } from "@/lib/storage";

export type DeleteReceiptResult =
  | { ok: true }
  | { ok: false; error: string };

const inputSchema = z.object({
  orderId: z.string().min(1).max(64),
  receiptId: z.string().min(1).max(64),
});

/**
 * Deletes a single payment receipt — the file, the DB row, and (if it was
 * the last receipt on the payment) resets the payment back to PENDING so
 * production is not left thinking an unverified/removed proof still stands.
 */
export async function deletePaymentReceipt(
  orderId: string,
  receiptId: string,
): Promise<DeleteReceiptResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = inputSchema.safeParse({ orderId, receiptId });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const isAdmin = session.user.roles.includes("ADMIN");
  const order = await db.order.findFirst({
    where: isAdmin
      ? { id: orderId }
      : { id: orderId, createdById: session.user.id },
    select: { id: true },
  });
  if (!order) return { ok: false, error: "Order not found." };

  const receipt = await db.paymentReceipt.findFirst({
    where: { id: receiptId, payment: { orderId } },
    include: { fileAsset: true, payment: { select: { id: true } } },
  });
  if (!receipt) return { ok: false, error: "Receipt not found." };

  try {
    await db.$transaction(async (tx) => {
      await tx.paymentReceipt.delete({ where: { id: receiptId } });

      const remaining = await tx.paymentReceipt.count({
        where: { paymentId: receipt.payment.id },
      });
      if (remaining === 0) {
        await tx.payment.update({
          where: { id: receipt.payment.id },
          data: { status: "PENDING", paidAt: null },
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "Order",
          entityId: orderId,
          action: "PAYMENT_RECEIPT_DELETED",
          fromValue: { fileAssetId: receipt.fileAssetId },
          actorId: session.user.id,
        },
      });
    });

    // Delete the underlying file after the DB commit succeeds — if the
    // transaction had failed, the file must still be reachable from the row.
    await deleteStoredFile(receipt.fileAsset.path);
    await db.fileAsset.delete({ where: { id: receipt.fileAssetId } });

    revalidatePath(`/asm/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    console.error("deletePaymentReceipt failed", err);
    return { ok: false, error: "Could not delete the receipt. Try again." };
  }
}
