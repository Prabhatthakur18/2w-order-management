"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import type { PackingUnit } from "@prisma/client";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { orderDraftSchema, type OrderLineDraft } from "@/lib/order-draft";
import { calculateOrder, combinedDiscountPct } from "@/lib/pricing";
import { getCurrentPrice, getDiscountRule } from "@/lib/catalog";
import { isEditable } from "@/lib/order-lifecycle";

export type UpdateOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

/**
 * Updates an order still inside its edit window.
 *
 * Like createOrder, the client is untrusted: prices and GST rates are
 * re-resolved from the database, discount caps re-enforced, and the edit
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

  const dealer = await db.dealer.findFirst({
    where: { id: draft.dealerId, isActive: true },
  });
  if (!dealer) return { ok: false, error: "That dealer is not available." };

  const pricedLines: (OrderLineDraft & { packingUnit: PackingUnit })[] = [];
  for (const line of draft.lines) {
    const partColour = await db.partColour.findFirst({
      where: { id: line.partColourId, isActive: true },
      include: { part: { include: { gstSlab: true } } },
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

    pricedLines.push({
      ...line,
      unitPrice: price.unitPrice.toString(),
      gstRatePct: partColour.part.gstSlab?.ratePct.toString() ?? "0",
      productCode: partColour.productCode,
      partNo: partColour.part.partNo,
      partName: partColour.part.name,
      colour: partColour.colour,
      packingUnit: partColour.part.packingUnit,
    });
  }

  const scheme = draft.schemeId
    ? await db.scheme.findFirst({
        where: { id: draft.schemeId, isActive: true },
      })
    : null;

  const totals = calculateOrder(pricedLines, {
    dealerDiscountPct: draft.dealerDiscountPct,
    schemeDiscountPct: scheme?.discountPct?.toString() ?? "0",
    schemeFlatAmount: scheme?.flatAmount?.toString() ?? "0",
  });

  const rule = await getDiscountRule();
  if (rule) {
    const combined = combinedDiscountPct(totals);
    if (combined.gt(new Decimal(rule.maxCombinedPct.toString()))) {
      return {
        ok: false,
        error: `Combined discount ${combined.toFixed(2)}% exceeds the ${rule.maxCombinedPct}% cap.`,
      };
    }
    if (
      !rule.allowStacking &&
      new Decimal(draft.dealerDiscountPct || "0").gt(0) &&
      scheme
    ) {
      return {
        ok: false,
        error: "Dealer discount and scheme cannot be combined.",
      };
    }
  }

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
            isVerified: false,
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
          dealerId: dealer.id,
          subDealerId,
          printingFrameId: draft.printingFrameId || null,
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
          schemeId: scheme?.id ?? null,
          schemeDiscountAmt: totals.schemeDiscountAmt.toString(),
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
                description: `${l.partNo} — ${l.partName} (${l.colour})`,
                packingUnit: l.packingUnit,
                qty: l.qty,
                unitPrice: l.unitPrice,
                lineGross: lt.gross.toString(),
                discountAmt: lt.discountAmt.toString(),
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
          toValue: { total: totals.total.toString() },
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
