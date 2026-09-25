import "server-only";
import { db } from "@/lib/db";

/**
 * Catalog reads for the order wizard.
 *
 * The cascade is filtered server-side at every level (Report Rec #3) — a
 * client-supplied parent id is always applied as a query constraint, so an
 * unfiltered list can never be returned.
 */

/**
 * Dealers usable for order creation. A PENDING dealer (added by an ASM,
 * awaiting Admin approval) must never appear here — only APPROVED ones do.
 */
export async function getDealers() {
  return db.dealer.findMany({
    where: { isActive: true, approvalStatus: "APPROVED" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      contactName: true,
      contactNo: true,
      gstin: true,
      creditLimit: true,
      creditDays: true,
    },
  });
}

export async function getTransporters() {
  return db.transporter.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function getDealer(dealerId: string) {
  return db.dealer.findFirst({
    where: { id: dealerId, isActive: true, approvalStatus: "APPROVED" },
    include: {
      // A dealer's sub-dealers may still include PENDING ones so the ASM
      // can see what they've submitted, but order creation must not offer
      // an unapproved sub-dealer as a selectable option — the wizard filters
      // these client-side to APPROVED before rendering the picker.
      subDealers: {
        where: { isActive: true },
        orderBy: { name: "asc" },
      },
      printingFrames: {
        where: { isActive: true },
        orderBy: { label: "asc" },
      },
    },
  });
}

export async function getOems() {
  return db.oem.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function getVehicles(oemId: string) {
  if (!oemId) return [];
  return db.vehicle.findMany({
    where: { oemId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function getParts(vehicleId: string) {
  if (!vehicleId) return [];
  return db.part.findMany({
    where: { vehicleId, isActive: true },
    orderBy: { partNo: "asc" },
    select: {
      id: true,
      partNo: true,
      name: true,
      packingUnit: true,
      seatType: true,
      gstSlab: { select: { ratePct: true } },
    },
  });
}

export async function getPartColours(partId: string) {
  if (!partId) return [];
  return db.partColour.findMany({
    where: { partId, isActive: true },
    orderBy: { colour: "asc" },
    select: { id: true, colour: true, productCode: true },
  });
}

/** Price in effect today for a SKU, honouring the dealer's tier. */
export async function getCurrentPrice(
  partColourId: string,
  priceTierId?: string | null,
) {
  const now = new Date();
  const where = {
    partColourId,
    isActive: true,
    validFrom: { lte: now },
    OR: [{ validTo: null }, { validTo: { gte: now } }],
  };

  // Tier-specific price wins; fall back to the untiered list price.
  if (priceTierId) {
    const tiered = await db.priceList.findFirst({
      where: { ...where, priceTierId },
      orderBy: { validFrom: "desc" },
    });
    if (tiered) return tiered;
  }

  return db.priceList.findFirst({
    where: { ...where, priceTierId: null },
    orderBy: { validFrom: "desc" },
  });
}

export async function getActiveSchemes() {
  const now = new Date();
  return db.scheme.findMany({
    where: {
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: { name: "asc" },
  });
}

export async function getDiscountRule() {
  return db.discountRule.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Business rules the Admin controls. */
export async function getConfig(keys: string[]) {
  const rows = await db.systemConfig.findMany({
    where: { key: { in: keys } },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export type OrderPartiesInput = {
  dealerId: string;
  subDealerId?: string | null;
  printingFrameId?: string | null;
  preferredTransporterId?: string | null;
};

/**
 * Resolves and validates every party an order points at.
 *
 * The wizard already narrows these lists — getDealers() above, and the
 * APPROVED sub-dealer filter in asm/orders/new/actions.ts — but that is the
 * *client's* view of what is selectable. This is the server-side equivalent,
 * so a crafted payload cannot attach an unapproved dealer, or a sub-dealer or
 * printing frame belonging to some other dealer.
 *
 * Ownership is the check that matters for the dealer-owned records: without
 * it an order could carry a different dealer's name and address onto the PI.
 * Sub-dealer approval status is deliberately NOT required — the wizard can
 * create a sub-dealer inline, which lands PENDING and is legitimately
 * attached to that same order while it waits for Admin review.
 */
export async function resolveOrderParties(input: OrderPartiesInput) {
  const dealer = await db.dealer.findFirst({
    where: { id: input.dealerId, isActive: true, approvalStatus: "APPROVED" },
  });
  if (!dealer) {
    return { ok: false as const, error: "That dealer is not available." };
  }

  if (input.subDealerId) {
    const subDealer = await db.subDealer.findFirst({
      where: { id: input.subDealerId, dealerId: dealer.id, isActive: true },
      select: { id: true },
    });
    if (!subDealer) {
      return {
        ok: false as const,
        error: "That sub-dealer does not belong to this dealer.",
      };
    }
  }

  if (input.printingFrameId) {
    const frame = await db.printingFrame.findFirst({
      where: { id: input.printingFrameId, dealerId: dealer.id, isActive: true },
      select: { id: true },
    });
    if (!frame) {
      return {
        ok: false as const,
        error: "That printing frame does not belong to this dealer.",
      };
    }
  }

  if (input.preferredTransporterId) {
    const transporter = await db.transporter.findFirst({
      where: { id: input.preferredTransporterId, isActive: true },
      select: { id: true },
    });
    if (!transporter) {
      return { ok: false as const, error: "That transporter is not available." };
    }
  }

  return { ok: true as const, dealer };
}
