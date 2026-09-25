"use server";

import { revalidatePath } from "next/cache";
import type { PackingUnit } from "@prisma/client";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import {
  lineDescription,
  orderDraftSchema,
  type OrderLineDraft,
} from "@/lib/order-draft";
import { calculateOrder, dealerDiscountPctNumber } from "@/lib/pricing";
import {
  getCurrentPrice,
  getDiscountRule,
  resolveOrderParties,
} from "@/lib/catalog";
import { isEditable } from "@/lib/order-lifecycle";

export type UpdateOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

const MAX_CREDIT_DAYS = 45;

/**
 * Updates an order still inside its edit window.
 *
 * Like createOrder, the client is untrusted: prices and GST rates are
 * re-resolved from the database, the discount band re-checked, and the edit
 * window re-checked server-side.
 */
export async function updateOrder(
  orderId: string,
  raw: unknown,
): Promise<UpdateOrderResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = orderDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "The order data was not valid." };
  }
  const draft = parsed.data;

  const isAdmin = session.user.roles.includes("ADMIN");
  const existing = await db.order.findFirst({
    where: isAdmin
      ? { id: orderId }
      : { id: orderId, createdById: session.user.id },
    select: { id: true, status: true, editableUntil: true },
  });
  if (!existing) return { ok: false, error: "Order not found." };

  // Re-check here: the window may have closed since the page was rendered.
  if (!isEditable(existing)) {
    return {
      ok: false,
      error: "The edit window has closed. This order can no longer be changed.",
    };
  }

  if (draft.lines.length === 0)
    return { ok: false, error: "Add at least one item." };
  if (!draft.paymentMode)
    return { ok: false, error: "Select a payment mode." };

  let creditDays: number | null = null;
  if (draft.paymentMode === "CREDIT") {
    const days = Number(draft.creditDays);
    if (!Number.isInteger(days) || days <= 0 || days > MAX_CREDIT_DAYS) {
      return {
        ok: false,
        error: `Enter a credit limit between 1 and ${MAX_CREDIT_DAYS} days.`,
      };
    }
    creditDays = days;
  }

  const parties = await resolveOrderParties({
    dealerId: draft.dealerId,
    subDealerId: draft.subDealerId,
    printingFrameId: draft.printingFrameId,
    preferredTransporterId: draft.preferredTransporterId,
  });
  if (!parties.ok) return { ok: false, error: parties.error };
  const { dealer } = parties;

  const pricedLines: (OrderLineDraft & { packingUnit: PackingUnit })[] = [];
  for (const line of draft.lines) {
    const partColour = await db.partColour.findFirst({
      where: { id: line.partColourId, isActive: true },
      include: { part: { include: { gstSlab: true, vehicle: true } } },
    });
    if (!partColour) {
      return { ok: false, error: `Item ${line.productCode} is unavailable.` };
    }

    const price = await getCurrentPrice(line.partColourId, dealer.priceTierId);
    if (!price) {
      return {
        ok: false,
        error: `No active price for ${partColour.productCode}.`,
      };
    }

    // A missing GST slab must not silently price the line at 0% tax — that
    // would put a wrong figure on the dealer's proforma invoice.
    if (!partColour.part.gstSlab) {
      return {
        ok: false,
        error: `No GST rate is set for ${partColour.productCode}. Admin must assign one before it can be ordered.`,
      };
    }

    pricedLines.push({
      ...line,
      unitPrice: price.unitPrice.toString(),
      gstRatePct: partColour.part.gstSlab.ratePct.toString(),
      productCode: partColour.productCode,
      partNo: partColour.part.partNo,
      partName: partColour.part.name,
      vehicleName: partColour.part.vehicle.name,
      colour: partColour.colour ?? "",
      packingUnit: partColour.part.packingUnit,
    });
  }

  // Scheme is a selectable label only — no cost effect (business direction).
  const scheme = draft.schemeId
    ? await db.scheme.findFirst({ where: { id: draft.schemeId, isActive: true } })
    : null;

  const totals = calculateOrder(pricedLines, {
    dealerDiscountPct: draft.dealerDiscountPct,
    paymentMode: draft.paymentMode,
  });

  const rule = await getDiscountRule();
  const discountPctNum = dealerDiscountPctNumber(draft.dealerDiscountPct || "0");
  const needsDiscountApproval = rule
    ? discountPctNum > 0 &&
      (discountPctNum < Number(rule.minDealerPct) ||
        discountPctNum > Number(rule.maxDealerPct))
    : false;

  try {
    await db.$transaction(async (tx) => {
      // Snapshot the pre-edit state so the change is auditable.
      const before = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { lines: true },
      });

      const versionCount = await tx.orderVersion.count({ where: { orderId } });
      await tx.orderVersion.create({
        data: {
          orderId,
          versionNo: versionCount + 1,
          snapshot: JSON.parse(JSON.stringify(before)),
          changeReason: "Edited within the edit window",
          changedById: session.user.id,
        },
      });

      let subDealerId = draft.subDealerId || null;
      if (!subDealerId && draft.newSubDealer?.name) {
        const created = await tx.subDealer.create({
          data: {
            dealerId: dealer.id,
            name: draft.newSubDealer.name,
            address: draft.newSubDealer.address,
            contactNo: draft.newSubDealer.contactNo,
            approvalStatus: "PENDING",
            createdById: session.user.id,
          },
        });
        subDealerId = created.id;
      }

      // Lines are replaced wholesale — simpler and safer than diffing, and
      // the previous set is preserved in the version snapshot above.
      await tx.orderLine.deleteMany({ where: { orderId } });

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentMode: draft.paymentMode,
          creditDays,
          dealerId: dealer.id,
          subDealerId,
          printingFrameId: draft.printingFrameId || null,
          preferredTransporterId: draft.preferredTransporterId || null,
          shippingSameAsDealer: draft.shippingSameAsDealer,
          shippingAddress: draft.shippingSameAsDealer
            ? null
            : draft.shippingAddress,
          shippingCity: draft.shippingSameAsDealer ? null : draft.shippingCity,
          shippingState: draft.shippingSameAsDealer
            ? null
            : draft.shippingState,
          shippingPincode: draft.shippingSameAsDealer
            ? null
            : draft.shippingPincode,
          totalQty: totals.totalQty,
          grossValue: totals.gross.toString(),
          dealerDiscountPct: draft.dealerDiscountPct || "0",
          dealerDiscountAmt: totals.dealerDiscountAmt.toString(),
          needsDiscountApproval,
          schemeId: scheme?.id ?? null,
          cashDiscountAmt: totals.cashDiscountAmt.toString(),
          netValue: totals.net.toString(),
          gstAmount: totals.gstAmount.toString(),
          totalValue: totals.total.toString(),
          finalPayable: totals.total.toString(),
          remarks: draft.remarks || null,
          lines: {
            create: pricedLines.map((l, i) => {
              const lt = totals.lines[i];
              return {
                partColourId: l.partColourId,
                productCode: l.productCode,
                description: lineDescription(l),
                packingUnit: l.packingUnit,
                qty: l.qty,
                unitPrice: l.unitPrice,
                lineGross: lt.gross.toString(),
                discountAmt: lt.discountAmt.toString(),
                cashDiscountAmt: lt.cashDiscountAmt.toString(),
                gstRatePct: l.gstRatePct,
                gstAmount: lt.gstAmount.toString(),
                lineNet: lt.net.toString(),
                remarks: l.remarks?.trim() || null,
              };
            }),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "Order",
          entityId: orderId,
          action: "EDITED",
          fromValue: { total: before.totalValue.toString() },
          toValue: { total: totals.total.toString(), needsDiscountApproval },
          actorId: session.user.id,
        },
      });
    });

    revalidatePath("/asm/orders");
    revalidatePath(`/asm/orders/${orderId}`);
    return { ok: true, orderId };
  } catch (err) {
    console.error("updateOrder failed", err);
    return { ok: false, error: "Could not save changes. Please try again." };
  }
}
