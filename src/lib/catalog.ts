import "server-only";
import { db } from "@/lib/db";

/**
 * Catalog reads for the order wizard.
 *
 * The cascade is filtered server-side at every level (Report Rec #3) — a
 * client-supplied parent id is always applied as a query constraint, so an
 * unfiltered list can never be returned.
 */

export async function getDealers() {
  return db.dealer.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      contactNo: true,
      creditLimit: true,
      creditDays: true,
    },
  });
}

export async function getDealer(dealerId: string) {
  return db.dealer.findFirst({
    where: { id: dealerId, isActive: true },
    include: {
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
