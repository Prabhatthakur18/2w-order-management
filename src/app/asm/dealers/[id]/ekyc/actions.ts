"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { storeFile, deleteStoredFile, ALLOWED_DOC_TYPES } from "@/lib/storage";

/**
 * eKYC — independent of Dealer/SubDealer approvalStatus, which already
 * governs order-usability on its own (see src/app/asm/dealers/actions.ts).
 * One EkycProfile per dealer OR per sub-dealer, created lazily on first
 * upload. One file per EkycDocType; re-uploading replaces the existing file.
 */

const ownerSchema = z.object({
  ownerType: z.enum(["DEALER", "SUBDEALER"]),
  ownerId: z.string().min(1).max(64),
  dealerId: z.string().min(1).max(64),
});

/**
 * Which page(s) show this eKYC — the sub-dealer's own page plus the parent
 * dealer's page (its sub-dealer summary card shows an eKYC status badge),
 * or just the dealer's own page when the owner is the dealer itself.
 */
function ekycRevalidatePaths(
  ownerType: "DEALER" | "SUBDEALER",
  ownerId: string,
  dealerId: string,
): string[] {
  return ownerType === "DEALER"
    ? [`/asm/dealers/${dealerId}`]
    : [`/asm/dealers/${dealerId}/sub-dealers/${ownerId}`, `/asm/dealers/${dealerId}`];
}

async function resolveOwner(
  session: { user: { id: string; roles: string[] } },
  ownerType: "DEALER" | "SUBDEALER",
  ownerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const isAdmin = session.user.roles.includes("ADMIN");
  if (ownerType === "DEALER") {
    const dealer = await db.dealer.findFirst({
      where: {
        id: ownerId,
        isActive: true,
        OR: isAdmin
          ? undefined
          : [{ approvalStatus: "APPROVED" }, { createdById: session.user.id }],
      },
      select: { id: true },
    });
    if (!dealer) return { ok: false, error: "Dealer not found." };
  } else {
    const subDealer = await db.subDealer.findFirst({
      where: {
        id: ownerId,
        isActive: true,
        OR: isAdmin
          ? undefined
          : [{ approvalStatus: "APPROVED" }, { createdById: session.user.id }],
      },
      select: { id: true },
    });
    if (!subDealer) return { ok: false, error: "Sub-dealer not found." };
  }
  return { ok: true };
}

export type UploadEkycResult =
  | { ok: true; documentId: string; fileAssetId: string }
  | { ok: false; error: string };

const uploadInputSchema = ownerSchema.extend({
  docType: z.enum(["AADHAR", "PAN", "CANCELLED_CHEQUE", "MOU"]),
});

export async function uploadEkycDocument(
  formData: FormData,
): Promise<UploadEkycResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = uploadInputSchema.safeParse({
    ownerType: formData.get("ownerType"),
    ownerId: formData.get("ownerId"),
    dealerId: formData.get("dealerId"),
    docType: formData.get("docType"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { ownerType, ownerId, dealerId, docType } = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose a file to upload." };
  }

  const owner = await resolveOwner(session, ownerType, ownerId);
  if (!owner.ok) return owner;

  let stored;
  try {
    stored = await storeFile(file, "ekyc-documents", ALLOWED_DOC_TYPES);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }

  let oldFileAssetId: string | null = null;
  let oldFilePath: string | null = null;

  try {
    const result = await db.$transaction(async (tx) => {
      const profile = await tx.ekycProfile.upsert({
        where:
          ownerType === "DEALER"
            ? { dealerId: ownerId }
            : { subDealerId: ownerId },
        update: {},
        create: {
          dealerId: ownerType === "DEALER" ? ownerId : null,
          subDealerId: ownerType === "SUBDEALER" ? ownerId : null,
          approvalStatus: "PENDING",
          createdById: session.user.id,
        },
      });

      // Resubmission: a new document after rejection puts it back in
      // Admin's queue instead of leaving it stuck REJECTED forever.
      if (profile.approvalStatus === "REJECTED") {
        await tx.ekycProfile.update({
          where: { id: profile.id },
          data: {
            approvalStatus: "PENDING",
            rejectedReason: null,
            reviewedById: null,
            reviewedAt: null,
          },
        });
      }

      const existingDoc = await tx.ekycDocument.findUnique({
        where: {
          ekycProfileId_docType: { ekycProfileId: profile.id, docType },
        },
        include: { fileAsset: { select: { id: true, path: true } } },
      });
      if (existingDoc) {
        oldFileAssetId = existingDoc.fileAsset.id;
        oldFilePath = existingDoc.fileAsset.path;
      }

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

      const document = await tx.ekycDocument.upsert({
        where: {
          ekycProfileId_docType: { ekycProfileId: profile.id, docType },
        },
        update: { fileAssetId: asset.id, uploadedById: session.user.id },
        create: {
          ekycProfileId: profile.id,
          docType,
          fileAssetId: asset.id,
          uploadedById: session.user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "EkycProfile",
          entityId: profile.id,
          action: "DOCUMENT_UPLOADED",
          toValue: { docType, fileAssetId: asset.id },
          actorId: session.user.id,
        },
      });

      return { documentId: document.id, assetId: asset.id };
    });

    if (oldFileAssetId && oldFilePath) {
      await deleteStoredFile(oldFilePath);
      await db.fileAsset.delete({ where: { id: oldFileAssetId } });
    }

    ekycRevalidatePaths(ownerType, ownerId, dealerId).forEach((p) => revalidatePath(p));
    return { ok: true, documentId: result.documentId, fileAssetId: result.assetId };
  } catch (err) {
    await deleteStoredFile(stored.path);
    console.error("uploadEkycDocument failed", err);
    return { ok: false, error: "Could not save the document. Try again." };
  }
}

export type DeleteEkycResult = { ok: true } | { ok: false; error: string };

const deleteInputSchema = z.object({
  dealerId: z.string().min(1).max(64),
  documentId: z.string().min(1).max(64),
});

export async function deleteEkycDocument(
  dealerId: string,
  documentId: string,
): Promise<DeleteEkycResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = deleteInputSchema.safeParse({ dealerId, documentId });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const document = await db.ekycDocument.findUnique({
    where: { id: parsed.data.documentId },
    include: {
      fileAsset: true,
      ekycProfile: { select: { dealerId: true, subDealerId: true } },
    },
  });
  if (!document) return { ok: false, error: "Document not found." };

  const ownerType: "DEALER" | "SUBDEALER" = document.ekycProfile.dealerId
    ? "DEALER"
    : "SUBDEALER";
  const ownerId =
    document.ekycProfile.dealerId ?? document.ekycProfile.subDealerId ?? "";

  try {
    await db.$transaction(async (tx) => {
      await tx.ekycDocument.delete({ where: { id: document.id } });
      await tx.auditLog.create({
        data: {
          entityType: "EkycProfile",
          entityId: document.ekycProfileId,
          action: "DOCUMENT_DELETED",
          fromValue: { docType: document.docType, fileAssetId: document.fileAssetId },
          actorId: session.user.id,
        },
      });
    });

    await deleteStoredFile(document.fileAsset.path);
    await db.fileAsset.delete({ where: { id: document.fileAssetId } });

    ekycRevalidatePaths(ownerType, ownerId, dealerId).forEach((p) => revalidatePath(p));
    return { ok: true };
  } catch (err) {
    console.error("deleteEkycDocument failed", err);
    return { ok: false, error: "Could not delete the document. Try again." };
  }
}

export type UpdateMouNoteResult = { ok: true } | { ok: false; error: string };

const mouNoteSchema = z.object({
  dealerId: z.string().min(1).max(64),
  ekycProfileId: z.string().min(1).max(64),
  note: z.string().trim().max(300),
});

export async function updateMouNote(
  dealerId: string,
  ekycProfileId: string,
  note: string,
): Promise<UpdateMouNoteResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = mouNoteSchema.safeParse({ dealerId, ekycProfileId, note });
  if (!parsed.success) return { ok: false, error: "Note is too long." };

  const profile = await db.ekycProfile.findUnique({
    where: { id: parsed.data.ekycProfileId },
    select: { id: true, dealerId: true, subDealerId: true },
  });
  if (!profile) return { ok: false, error: "eKYC profile not found." };

  const ownerType: "DEALER" | "SUBDEALER" = profile.dealerId ? "DEALER" : "SUBDEALER";
  const ownerId = profile.dealerId ?? profile.subDealerId ?? "";

  await db.$transaction([
    db.ekycProfile.update({
      where: { id: profile.id },
      data: { mouNote: parsed.data.note || null },
    }),
    db.auditLog.create({
      data: {
        entityType: "EkycProfile",
        entityId: profile.id,
        action: "MOU_NOTE_UPDATED",
        actorId: session.user.id,
      },
    }),
  ]);

  ekycRevalidatePaths(ownerType, ownerId, parsed.data.dealerId).forEach((p) => revalidatePath(p));
  return { ok: true };
}
