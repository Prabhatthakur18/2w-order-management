"use server";

import { z } from "zod";
import { requireRole } from "@/lib/guard";
import {
  getDealer,
  getVehicles,
  getParts,
  getPartColours,
  getCurrentPrice,
} from "@/lib/catalog";

/**
 * Cascade actions. Every one re-checks the role — middleware is a convenience,
 * not the authorization boundary — and applies the parent id as a query
 * constraint so an unfiltered list can never come back.
 */

const idSchema = z.string().min(1).max(64);

export async function loadDealerDetail(dealerId: string) {
  await requireRole(["ASM", "ADMIN"]);
  const parsed = idSchema.safeParse(dealerId);
  if (!parsed.success) return null;

  const dealer = await getDealer(parsed.data);
  if (!dealer) return null;

  return {
    id: dealer.id,
    name: dealer.name,
    address: dealer.address,
    city: dealer.city,
    state: dealer.state,
    pincode: dealer.pincode,
    contactNo: dealer.contactNo,
    priceTierId: dealer.priceTierId,
    subDealers: dealer.subDealers.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      contactNo: s.contactNo,
    })),
    printingFrames: dealer.printingFrames.map((f) => ({
      id: f.id,
      label: f.label,
      isDefault: f.isDefault,
    })),
  };
}

export async function loadVehicles(oemId: string) {
  await requireRole(["ASM", "ADMIN"]);
  const parsed = idSchema.safeParse(oemId);
  if (!parsed.success) return [];
  return getVehicles(parsed.data);
}

export async function loadParts(vehicleId: string) {
  await requireRole(["ASM", "ADMIN"]);
  const parsed = idSchema.safeParse(vehicleId);
  if (!parsed.success) return [];
  const parts = await getParts(parsed.data);
  return parts.map((p) => ({
    id: p.id,
    partNo: p.partNo,
    name: p.name,
    packingUnit: p.packingUnit,
    gstRatePct: p.gstSlab ? p.gstSlab.ratePct.toString() : "0",
  }));
}

export async function loadColours(partId: string) {
  await requireRole(["ASM", "ADMIN"]);
  const parsed = idSchema.safeParse(partId);
  if (!parsed.success) return [];
  return getPartColours(parsed.data);
}

/** Resolves the price in effect now — the value snapshotted onto the line. */
export async function loadPrice(
  partColourId: string,
  priceTierId: string | null,
) {
  await requireRole(["ASM", "ADMIN"]);
  const parsed = idSchema.safeParse(partColourId);
  if (!parsed.success) return null;

  const price = await getCurrentPrice(parsed.data, priceTierId);
  return price ? { unitPrice: price.unitPrice.toString() } : null;
}
