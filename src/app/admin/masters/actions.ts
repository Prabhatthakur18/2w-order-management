"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";

/**
 * Admin approve/reject actions for ASM-submitted dealers and sub-dealers.
 * Every decision is audited — an Admin discount-cap or approval override
 * must be traceable.
 */

const idSchema = z.string().min(1).max(64);

export type ReviewResult = { ok: true } | { ok: false; error: string };

export async function approveDealer(dealerId: string): Promise<ReviewResult> {
  const session = await requireRole(["ADMIN"]);
  const parsed = idSchema.safeParse(dealerId);
  if (!parsed.success) return { ok: false, error: "Invalid dealer." };

  const dealer = await db.dealer.findFirst({
    where: { id: parsed.data, approvalStatus: "PENDING" },
    select: { id: true },
  });
  if (!dealer) return { ok: false, error: "This dealer is no longer pending." };

  await db.$transaction([
    db.dealer.update({
      where: { id: parsed.data },
      data: {
        approvalStatus: "APPROVED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectedReason: null,
      },
    }),
    db.auditLog.create({
      data: {
        entityType: "Dealer",
        entityId: parsed.data,
        action: "APPROVED",
        actorId: session.user.id,
      },
    }),
  ]);

  revalidatePath("/admin/masters");
  return { ok: true };
}

export async function rejectDealer(
  dealerId: string,
  reason: string,
): Promise<ReviewResult> {
  const session = await requireRole(["ADMIN"]);
  const parsed = idSchema.safeParse(dealerId);
  if (!parsed.success) return { ok: false, error: "Invalid dealer." };

  const dealer = await db.dealer.findFirst({
    where: { id: parsed.data, approvalStatus: "PENDING" },
    select: { id: true },
  });
  if (!dealer) return { ok: false, error: "This dealer is no longer pending." };

  await db.$transaction([
    db.dealer.update({
      where: { id: parsed.data },
      data: {
        approvalStatus: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectedReason: reason.trim().slice(0, 300) || "Not specified",
      },
    }),
    db.auditLog.create({
      data: {
        entityType: "Dealer",
        entityId: parsed.data,
        action: "REJECTED",
        toValue: { reason },
        actorId: session.user.id,
      },
    }),
  ]);

  revalidatePath("/admin/masters");
  return { ok: true };
}

export async function approveSubDealer(
  subDealerId: string,
): Promise<ReviewResult> {
  const session = await requireRole(["ADMIN"]);
  const parsed = idSchema.safeParse(subDealerId);
  if (!parsed.success) return { ok: false, error: "Invalid sub-dealer." };

  const subDealer = await db.subDealer.findFirst({
    where: { id: parsed.data, approvalStatus: "PENDING" },
    select: { id: true },
  });
  if (!subDealer) {
    return { ok: false, error: "This sub-dealer is no longer pending." };
  }

  await db.$transaction([
    db.subDealer.update({
      where: { id: parsed.data },
      data: {
        approvalStatus: "APPROVED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectedReason: null,
      },
    }),
    db.auditLog.create({
      data: {
        entityType: "SubDealer",
        entityId: parsed.data,
        action: "APPROVED",
        actorId: session.user.id,
      },
    }),
  ]);

  revalidatePath("/admin/masters");
  return { ok: true };
}

export async function rejectSubDealer(
  subDealerId: string,
  reason: string,
): Promise<ReviewResult> {
  const session = await requireRole(["ADMIN"]);
  const parsed = idSchema.safeParse(subDealerId);
  if (!parsed.success) return { ok: false, error: "Invalid sub-dealer." };

  const subDealer = await db.subDealer.findFirst({
    where: { id: parsed.data, approvalStatus: "PENDING" },
    select: { id: true },
  });
  if (!subDealer) {
    return { ok: false, error: "This sub-dealer is no longer pending." };
  }

  await db.$transaction([
    db.subDealer.update({
      where: { id: parsed.data },
      data: {
        approvalStatus: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectedReason: reason.trim().slice(0, 300) || "Not specified",
      },
    }),
    db.auditLog.create({
      data: {
        entityType: "SubDealer",
        entityId: parsed.data,
        action: "REJECTED",
        toValue: { reason },
        actorId: session.user.id,
      },
    }),
  ]);

  revalidatePath("/admin/masters");
  return { ok: true };
}

/**
 * eKYC approve/reject — independent of Dealer/SubDealer approvalStatus
 * above (see src/app/asm/dealers/[id]/ekyc/actions.ts). Also revalidates
 * the dealer detail page, since that's where eKYC status displays.
 */

async function ekycRevalidatePaths(ekycProfileId: string): Promise<string[]> {
  const profile = await db.ekycProfile.findUnique({
    where: { id: ekycProfileId },
    select: {
      dealerId: true,
      subDealerId: true,
      subDealer: { select: { dealerId: true } },
    },
  });
  if (!profile) return [];
  if (profile.dealerId) return [`/asm/dealers/${profile.dealerId}`];
  if (profile.subDealerId && profile.subDealer) {
    return [
      `/asm/dealers/${profile.subDealer.dealerId}/sub-dealers/${profile.subDealerId}`,
      `/asm/dealers/${profile.subDealer.dealerId}`,
    ];
  }
  return [];
}

export async function approveEkyc(ekycProfileId: string): Promise<ReviewResult> {
  const session = await requireRole(["ADMIN"]);
  const parsed = idSchema.safeParse(ekycProfileId);
  if (!parsed.success) return { ok: false, error: "Invalid eKYC profile." };

  const profile = await db.ekycProfile.findFirst({
    where: { id: parsed.data, approvalStatus: "PENDING" },
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "This eKYC is no longer pending." };

  const paths = await ekycRevalidatePaths(parsed.data);

  await db.$transaction([
    db.ekycProfile.update({
      where: { id: parsed.data },
      data: {
        approvalStatus: "APPROVED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectedReason: null,
      },
    }),
    db.auditLog.create({
      data: {
        entityType: "EkycProfile",
        entityId: parsed.data,
        action: "APPROVED",
        actorId: session.user.id,
      },
    }),
  ]);

  revalidatePath("/admin/masters");
  paths.forEach((p) => revalidatePath(p));
  return { ok: true };
}

export async function rejectEkyc(
  ekycProfileId: string,
  reason: string,
): Promise<ReviewResult> {
  const session = await requireRole(["ADMIN"]);
  const parsed = idSchema.safeParse(ekycProfileId);
  if (!parsed.success) return { ok: false, error: "Invalid eKYC profile." };

  const profile = await db.ekycProfile.findFirst({
    where: { id: parsed.data, approvalStatus: "PENDING" },
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "This eKYC is no longer pending." };

  const paths = await ekycRevalidatePaths(parsed.data);

  await db.$transaction([
    db.ekycProfile.update({
      where: { id: parsed.data },
      data: {
        approvalStatus: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectedReason: reason.trim().slice(0, 300) || "Not specified",
      },
    }),
    db.auditLog.create({
      data: {
        entityType: "EkycProfile",
        entityId: parsed.data,
        action: "REJECTED",
        toValue: { reason },
        actorId: session.user.id,
      },
    }),
  ]);

  revalidatePath("/admin/masters");
  paths.forEach((p) => revalidatePath(p));
  return { ok: true };
}
