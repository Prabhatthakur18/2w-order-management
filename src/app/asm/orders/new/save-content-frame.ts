"use server";

import { z } from "zod";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";

export type SaveContentFrameResult =
  | { ok: true; id: string; label: string }
  | { ok: false; error: string };

const inputSchema = z.object({
  dealerId: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(80),
  contentText: z.string().trim().min(1).max(2000),
  contentLanguage: z.string().min(2).max(10),
  withOemLogo: z.boolean(),
});

/**
 * Saves a printing-frame "content" variant — typed text plus a language and
 * an OEM-logo toggle, as an alternative to an uploaded image. Stored against
 * the dealer, same as image-mode frames (Report Rec #2).
 */
export async function saveContentFrame(
  input: z.infer<typeof inputSchema>,
): Promise<SaveContentFrameResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Fill in the content and language." };
  }
  const { dealerId, label, contentText, contentLanguage, withOemLogo } =
    parsed.data;

  const dealer = await db.dealer.findFirst({
    where: { id: dealerId, isActive: true },
    select: { id: true },
  });
  if (!dealer) return { ok: false, error: "That dealer is not available." };

  try {
    const created = await db.$transaction(async (tx) => {
      const frame = await tx.printingFrame.create({
        data: {
          dealerId,
          label,
          mode: "CONTENT",
          contentText,
          contentLanguage,
          withOemLogo,
          isDefault: false,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "PrintingFrame",
          entityId: frame.id,
          action: "CONTENT_SAVED",
          toValue: { label, dealerId, contentLanguage, withOemLogo },
          actorId: session.user.id,
        },
      });

      return frame;
    });

    return { ok: true, id: created.id, label: created.label };
  } catch (err) {
    console.error("saveContentFrame failed", err);
    return { ok: false, error: "Could not save the content. Try again." };
  }
}
