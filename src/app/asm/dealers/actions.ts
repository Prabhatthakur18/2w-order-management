"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { lookupGstin, type GstLookupResult } from "@/lib/gst-lookup";

/**
 * Dealer/sub-dealer creation by an ASM.
 *
 * Anything an ASM adds here lands as PENDING and is invisible to order
 * creation (see getDealers/getDealer in catalog.ts) until an Admin approves
 * it in /admin/masters. Admin-seeded masters bypass this entirely by being
 * created directly as APPROVED.
 */

export async function verifyGstin(gstin: string): Promise<GstLookupResult> {
  await requireRole(["ASM", "ADMIN"]);
  return lookupGstin(gstin);
}

/** Short, collision-free code — DocumentSequence gives us the same
 * guarantee already used for order/PI numbering. */
async function nextDealerCode(): Promise<string> {
  const fy = new Date().getFullYear();
  const seq = await db.documentSequence.upsert({
    where: { docType_financialYear: { docType: "DEALER_CODE", financialYear: String(fy) } },
    update: { lastNumber: { increment: 1 } },
    create: {
      docType: "DEALER_CODE",
      financialYear: String(fy),
      prefix: "DLR",
      lastNumber: 900, // ASM-created dealers start above the seeded DLR001/002 range
    },
  });
  return `${seq.prefix}${seq.lastNumber}`;
}

const dealerInputSchema = z.object({
  gstin: z.string().trim().max(15).optional().default(""),
  name: z.string().trim().min(1, "Name is required").max(120),
  address: z.string().trim().min(1, "Address is required").max(300),
  city: z.string().trim().min(1, "City is required").max(80),
  state: z.string().trim().min(1, "State is required").max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit pincode"),
  contactName: z.string().trim().max(120).optional().default(""),
  contactNo: z.string().trim().min(6, "Contact number is required").max(20),
  email: z.string().trim().email().optional().or(z.literal("")).default(""),
  gstLegalName: z.string().trim().optional().default(""),
  gstTradeName: z.string().trim().optional().default(""),
  gstStatus: z.string().trim().optional().default(""),
  gstRegisteredAt: z.string().trim().optional().default(""),
});

export type CreateDealerResult =
  | { ok: true; dealerId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createDealer(
  raw: unknown,
): Promise<CreateDealerResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = dealerInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  try {
    const code = await nextDealerCode();
    const created = await db.dealer.create({
      data: {
        code,
        name: input.name,
        gstin: input.gstin || null,
        address: input.address,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        contactName: input.contactName || null,
        contactNo: input.contactNo,
        email: input.email || null,
        gstLegalName: input.gstLegalName || null,
        gstTradeName: input.gstTradeName || null,
        gstStatus: input.gstStatus || null,
        gstRegisteredAt: input.gstRegisteredAt
          ? new Date(input.gstRegisteredAt)
          : null,
        approvalStatus: "PENDING",
        createdById: session.user.id,
      },
    });

    await db.auditLog.create({
      data: {
        entityType: "Dealer",
        entityId: created.id,
        action: "CREATED_PENDING",
        toValue: { name: input.name, gstin: input.gstin || null },
        actorId: session.user.id,
      },
    });

    revalidatePath("/asm/dealers");
    return { ok: true, dealerId: created.id };
  } catch (err) {
    console.error("createDealer failed", err);
    return { ok: false, error: "Could not save the dealer. Try again." };
  }
}

/**
 * Editing an already-APPROVED (or REJECTED) dealer resets it to PENDING for
 * re-review — only if a tracked field actually changed, so a no-op save
 * doesn't knock a dealer out of getDealers()'s APPROVED filter for nothing.
 */
export async function updateDealer(
  dealerId: string,
  raw: unknown,
): Promise<CreateDealerResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = dealerInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const current = await db.dealer.findFirst({
    where: {
      id: dealerId,
      isActive: true,
      OR: [{ approvalStatus: "APPROVED" }, { createdById: session.user.id }],
    },
  });
  if (!current) return { ok: false, error: "Dealer not found." };

  const next = {
    name: input.name,
    gstin: input.gstin || null,
    address: input.address,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    contactName: input.contactName || null,
    contactNo: input.contactNo,
    email: input.email || null,
    gstLegalName: input.gstLegalName || null,
    gstTradeName: input.gstTradeName || null,
    gstStatus: input.gstStatus || null,
    gstRegisteredAt: input.gstRegisteredAt ? new Date(input.gstRegisteredAt) : null,
  };

  const changed =
    next.name !== current.name ||
    next.gstin !== current.gstin ||
    next.address !== current.address ||
    next.city !== current.city ||
    next.state !== current.state ||
    next.pincode !== current.pincode ||
    next.contactName !== current.contactName ||
    next.contactNo !== current.contactNo ||
    next.email !== current.email ||
    next.gstLegalName !== current.gstLegalName ||
    next.gstTradeName !== current.gstTradeName ||
    next.gstStatus !== current.gstStatus ||
    next.gstRegisteredAt?.getTime() !== current.gstRegisteredAt?.getTime();

  const resets = changed && current.approvalStatus !== "PENDING";

  try {
    await db.$transaction([
      db.dealer.update({
        where: { id: dealerId },
        data: {
          ...next,
          ...(resets
            ? {
                approvalStatus: "PENDING",
                reviewedById: null,
                reviewedAt: null,
                rejectedReason: null,
              }
            : {}),
        },
      }),
      db.auditLog.create({
        data: {
          entityType: "Dealer",
          entityId: dealerId,
          action: resets ? "EDITED_PENDING" : "EDITED",
          fromValue: {
            name: current.name,
            gstin: current.gstin,
            address: current.address,
            city: current.city,
            state: current.state,
            pincode: current.pincode,
            contactName: current.contactName,
            contactNo: current.contactNo,
            email: current.email,
          },
          toValue: {
            name: next.name,
            gstin: next.gstin,
            address: next.address,
            city: next.city,
            state: next.state,
            pincode: next.pincode,
            contactName: next.contactName,
            contactNo: next.contactNo,
            email: next.email,
          },
          actorId: session.user.id,
        },
      }),
    ]);

    revalidatePath(`/asm/dealers/${dealerId}`);
    revalidatePath("/asm/dealers");
    if (resets) revalidatePath("/admin/masters");
    return { ok: true, dealerId };
  } catch (err) {
    console.error("updateDealer failed", err);
    return { ok: false, error: "Could not save the dealer. Try again." };
  }
}

const subDealerInputSchema = z.object({
  dealerId: z.string().min(1, "Select a dealer"),
  gstin: z.string().trim().max(15).optional().default(""),
  name: z.string().trim().min(1, "Name is required").max(120),
  address: z.string().trim().min(1, "Address is required").max(300),
  city: z.string().trim().max(80).optional().default(""),
  state: z.string().trim().max(80).optional().default(""),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a 6-digit pincode")
    .optional()
    .or(z.literal(""))
    .default(""),
  contactNo: z.string().trim().min(6, "Contact number is required").max(20),
  email: z.string().trim().email().optional().or(z.literal("")).default(""),
  gstLegalName: z.string().trim().optional().default(""),
  gstTradeName: z.string().trim().optional().default(""),
  gstStatus: z.string().trim().optional().default(""),
  gstRegisteredAt: z.string().trim().optional().default(""),
});

export type CreateSubDealerResult =
  | { ok: true; subDealerId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createSubDealer(
  raw: unknown,
): Promise<CreateSubDealerResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = subDealerInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const dealer = await db.dealer.findFirst({
    where: { id: input.dealerId },
    select: { id: true },
  });
  if (!dealer) return { ok: false, error: "That dealer is not available." };

  try {
    const created = await db.subDealer.create({
      data: {
        dealerId: input.dealerId,
        name: input.name,
        gstin: input.gstin || null,
        address: input.address,
        city: input.city || null,
        state: input.state || null,
        pincode: input.pincode || null,
        contactNo: input.contactNo,
        email: input.email || null,
        gstLegalName: input.gstLegalName || null,
        gstTradeName: input.gstTradeName || null,
        gstStatus: input.gstStatus || null,
        gstRegisteredAt: input.gstRegisteredAt
          ? new Date(input.gstRegisteredAt)
          : null,
        approvalStatus: "PENDING",
        createdById: session.user.id,
      },
    });

    await db.auditLog.create({
      data: {
        entityType: "SubDealer",
        entityId: created.id,
        action: "CREATED_PENDING",
        toValue: { name: input.name, dealerId: input.dealerId },
        actorId: session.user.id,
      },
    });

    revalidatePath("/asm/dealers");
    return { ok: true, subDealerId: created.id };
  } catch (err) {
    console.error("createSubDealer failed", err);
    return { ok: false, error: "Could not save the sub-dealer. Try again." };
  }
}

/** Same reset-on-change-only philosophy as updateDealer. */
export async function updateSubDealer(
  subDealerId: string,
  raw: unknown,
): Promise<CreateSubDealerResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = subDealerInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const current = await db.subDealer.findFirst({
    where: {
      id: subDealerId,
      isActive: true,
      OR: [{ approvalStatus: "APPROVED" }, { createdById: session.user.id }],
    },
  });
  if (!current) return { ok: false, error: "Sub-dealer not found." };

  const next = {
    name: input.name,
    gstin: input.gstin || null,
    address: input.address,
    city: input.city || null,
    state: input.state || null,
    pincode: input.pincode || null,
    contactNo: input.contactNo,
    email: input.email || null,
    gstLegalName: input.gstLegalName || null,
    gstTradeName: input.gstTradeName || null,
    gstStatus: input.gstStatus || null,
    gstRegisteredAt: input.gstRegisteredAt ? new Date(input.gstRegisteredAt) : null,
  };

  const changed =
    next.name !== current.name ||
    next.gstin !== current.gstin ||
    next.address !== current.address ||
    next.city !== current.city ||
    next.state !== current.state ||
    next.pincode !== current.pincode ||
    next.contactNo !== current.contactNo ||
    next.email !== current.email ||
    next.gstLegalName !== current.gstLegalName ||
    next.gstTradeName !== current.gstTradeName ||
    next.gstStatus !== current.gstStatus ||
    next.gstRegisteredAt?.getTime() !== current.gstRegisteredAt?.getTime();

  const resets = changed && current.approvalStatus !== "PENDING";

  try {
    await db.$transaction([
      db.subDealer.update({
        where: { id: subDealerId },
        data: {
          ...next,
          ...(resets
            ? {
                approvalStatus: "PENDING",
                reviewedById: null,
                reviewedAt: null,
                rejectedReason: null,
              }
            : {}),
        },
      }),
      db.auditLog.create({
        data: {
          entityType: "SubDealer",
          entityId: subDealerId,
          action: resets ? "EDITED_PENDING" : "EDITED",
          fromValue: {
            name: current.name,
            gstin: current.gstin,
            address: current.address,
            city: current.city,
            state: current.state,
            pincode: current.pincode,
            contactNo: current.contactNo,
            email: current.email,
          },
          toValue: {
            name: next.name,
            gstin: next.gstin,
            address: next.address,
            city: next.city,
            state: next.state,
            pincode: next.pincode,
            contactNo: next.contactNo,
            email: next.email,
          },
          actorId: session.user.id,
        },
      }),
    ]);

    revalidatePath(`/asm/dealers/${current.dealerId}/sub-dealers/${subDealerId}`);
    revalidatePath(`/asm/dealers/${current.dealerId}`);
    if (resets) revalidatePath("/admin/masters");
    return { ok: true, subDealerId };
  } catch (err) {
    console.error("updateSubDealer failed", err);
    return { ok: false, error: "Could not save the sub-dealer. Try again." };
  }
}
