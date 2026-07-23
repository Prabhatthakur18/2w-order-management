"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import {
  storeFile,
  deleteStoredFile,
  ALLOWED_DOC_TYPES,
} from "@/lib/storage";

export type UploadReceiptResult =
  | { ok: true; receiptId: string; fileAssetId: string }
  | { ok: false; error: string };

const inputSchema = z.object({
  orderId: z.string().min(1).max(64),
});

/**
 * Uploads a payment receipt for an Advance-payment order.
 *
 * Mirrors upload-frame.ts: store the bytes, then the DB rows in a
 * transaction, and clean up the orphaned file if the transaction fails.
 */
export async function uploadPaymentReceipt(
  formData: FormData,
): Promise<UploadReceiptResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = inputSchema.safeParse({ orderId: formData.get("orderId") });
  if (!parsed.success) {
    return { ok: false, error: "Invalid order." };
  }
  const { orderId } = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose a file to upload." };
  }

  const isAdmin = session.user.roles.includes("ADMIN");
  const order = await db.order.findFirst({
    where: isAdmin
      ? { id: orderId }
      : { id: orderId, createdById: session.user.id },
    select: { id: true, paymentMode: true, totalValue: true },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.paymentMode !== "ADVANCE") {
    return {
      ok: false,
      error: "Payment receipts apply to advance-payment orders only.",
    };
  }

  let stored;
  try {
    stored = await storeFile(file, "payment-receipts", ALLOWED_DOC_TYPES);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const asset = await tx.fileAsset.create({
        data: {
          path: stored.path,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          checksum: stored.checksum,
          uploadedById: session.user.id,
        },
      });

      // One Payment per order for now; reuse it if a receipt was uploaded
      // before (e.g. a corrected file).
      const payment = await tx.payment.upsert({
        where: { orderId_mode: { orderId, mode: "ADVANCE" } },
        update: {},
        create: {
          orderId,
          mode: "ADVANCE",
          status: "PENDING",
          amount: order.totalValue,
        },
      });

      const receipt = await tx.paymentReceipt.create({
        data: { paymentId: payment.id, fileAssetId: asset.id },
      });

      // Receipt uploaded but not yet verified — Accounts confirms it later.
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "RECEIVED", paidAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          entityType: "Order",
          entityId: orderId,
          action: "PAYMENT_RECEIPT_UPLOADED",
          toValue: { fileAssetId: asset.id },
          actorId: session.user.id,
        },
      });

      return { receiptId: receipt.id, assetId: asset.id };
    });

    revalidatePath(`/asm/orders/${orderId}`);
    return { ok: true, receiptId: result.receiptId, fileAssetId: result.assetId };
  } catch (err) {
    await deleteStoredFile(stored.path);
    console.error("uploadPaymentReceipt failed", err);
    return { ok: false, error: "Could not save the receipt. Try again." };
  }
}
