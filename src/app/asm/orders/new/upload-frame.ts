"use server";

import { z } from "zod";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { storeFile, deleteStoredFile, ALLOWED_IMAGE_TYPES } from "@/lib/storage";

export type UploadFrameResult =
  | { ok: true; id: string; label: string; fileAssetId: string }
  | { ok: false; error: string };

const inputSchema = z.object({
  dealerId: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(80),
});

/**
 * Uploads dealer printing-frame artwork.
 *
 * Stored against the dealer, not the order, so it is reusable across orders
 * (Report Rec #2) — the ASM only re-uploads when the artwork actually changes.
 */
export async function uploadPrintingFrame(
  formData: FormData,
): Promise<UploadFrameResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = inputSchema.safeParse({
    dealerId: formData.get("dealerId"),
    label: formData.get("label"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Provide a name for the artwork." };
  }
  const { dealerId, label } = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose an image to upload." };
  }

  const dealer = await db.dealer.findFirst({
    where: { id: dealerId, isActive: true },
    select: { id: true },
  });
  if (!dealer) {
    return { ok: false, error: "That dealer is not available." };
  }

  let stored;
  try {
    stored = await storeFile(file, "printing-frames", ALLOWED_IMAGE_TYPES);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }

  try {
    const frame = await db.$transaction(async (tx) => {
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

      const created = await tx.printingFrame.create({
        data: {
          dealerId,
          label,
          mode: "IMAGE",
          fileAssetId: asset.id,
          isDefault: false,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "PrintingFrame",
          entityId: created.id,
          action: "UPLOADED",
          toValue: { label, dealerId, fileAssetId: asset.id },
          actorId: session.user.id,
        },
      });

      return { created, assetId: asset.id };
    });

    return {
      ok: true,
      id: frame.created.id,
      label: frame.created.label,
      fileAssetId: frame.assetId,
    };
  } catch (err) {
    // The bytes are on disk but the row failed — remove the orphan.
    await deleteStoredFile(stored.path);
    console.error("uploadPrintingFrame failed", err);
    return { ok: false, error: "Could not save the artwork. Try again." };
  }
}
