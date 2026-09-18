"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import type { PackingUnit } from "@prisma/client";
import { orderDraftSchema, type OrderLineDraft } from "@/lib/order-draft";
import { calculateOrder, dealerDiscountPctNumber } from "@/lib/pricing";
import { getCurrentPrice, getDiscountRule } from "@/lib/catalog";
import {
  allocateDocNumber,
  editDeadline,
  getEditWindowHours,
} from "@/lib/order-lifecycle";

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNo: string }
  | { ok: false; error: string };

const MAX_CREDIT_DAYS = 45;

/**
 * Creates the order. Every client-side check is repeated here — prices are
 * re-resolved from the database rather than trusted from the payload, and
 * the discount band is re-checked. The client is treated as untrusted input.
 */
export async function createOrder(
  raw: unknown,
): Promise<CreateOrderResult> {
  const session = await requireRole(["ASM", "ADMIN"]);

  const parsed = orderDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "The order data was not valid." };
  }
  const draft = parsed.data;

  if (!draft.dealerId) return { ok: false, error: "Select a dealer." };
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

  const dealer = await db.dealer.findFirst({
    where: { id: draft.dealerId, isActive: true },
  });
  if (!dealer) return { ok: false, error: "That dealer is not available." };

  if (draft.preferredTransporterId) {
    const transporter = await db.transporter.findFirst({
      where: { id: draft.preferredTransporterId, isActive: true },
      select: { id: true },
    });
    if (!transporter) {
      return { ok: false, error: "That transporter is not available." };
    }
  }

  // Re-resolve every price server-side. A stale or tampered client price
  // must never reach the order.
  const pricedLines: (OrderLineDraft & {
    packingUnit: PackingUnit;
  })[] = [];
  for (const line of draft.lines) {
    const partColour = await db.partColour.findFirst({
      where: { id: line.partColourId, isActive: true },
      include: {
        part: { include: { gstSlab: true, vehicle: { include: { oem: true } } } },
      },
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

  // Scheme is a selectable label only — no cost effect (business direction).
  const scheme = draft.schemeId
    ? await db.scheme.findFirst({ where: { id: draft.schemeId, isActive: true } })
    : null;

  const totals = calculateOrder(pricedLines, {
    dealerDiscountPct: draft.dealerDiscountPct,
    paymentMode: draft.paymentMode,
  });

  // Dealer discount outside the Admin band never blocks the order — it just
  // needs Admin approval afterwards (business direction).
  const rule = await getDiscountRule();
  const discountPctNum = dealerDiscountPctNumber(draft.dealerDiscountPct || "0");
  const needsDiscountApproval = rule
    ? discountPctNum > 0 &&
      (discountPctNum < Number(rule.minDealerPct) ||
        discountPctNum > Number(rule.maxDealerPct))
    : false;

  const orderNo = await nextOrderNumber();
  const editWindowHours = await getEditWindowHours();

  try {
    const order = await db.$transaction(async (tx) => {
      // Sub-dealer created inline lands as PENDING, same as the standalone
      // add-sub-dealer flow — it goes to the same Admin approval queue.
      let subDealerId = draft.subDealerId || null;
      if (!subDealerId && draft.newSubDealer?.name) {
        const nsd = draft.newSubDealer;
        const created = await tx.subDealer.create({
          data: {
            dealerId: dealer.id,
            gstin: nsd.gstin || null,
            name: nsd.name,
            address: nsd.address,
            city: nsd.city || null,
            state: nsd.state || null,
            pincode: nsd.pincode || null,
            contactNo: nsd.contactNo,
            email: nsd.email || null,
            gstLegalName: nsd.gstLegalName || null,
            gstTradeName: nsd.gstTradeName || null,
            gstStatus: nsd.gstStatus || null,
            gstRegisteredAt: nsd.gstRegisteredAt ? new Date(nsd.gstRegisteredAt) : null,
            approvalStatus: "PENDING",
            createdById: session.user.id,
          },
        });
        subDealerId = created.id;
      }

      const created = await tx.order.create({
        data: {
          orderNo,
          status: "CREATED",
          editableUntil: editDeadline(new Date(), editWindowHours),
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
          createdById: session.user.id,
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
          entityId: created.id,
          action: "CREATED",
          toValue: {
            orderNo,
            status: "CREATED",
            total: totals.total.toString(),
            needsDiscountApproval,
          },
          actorId: session.user.id,
        },
      });

      return created;
    });

    revalidatePath("/asm/orders");
    return { ok: true, orderId: order.id, orderNo: order.orderNo };
  } catch (err) {
    console.error("createOrder failed", err);
    return { ok: false, error: "Could not save the order. Please try again." };
  }
}

/** ORDER/{FY}/{00001} from a DB sequence. */
async function nextOrderNumber(): Promise<string> {
  return allocateDocNumber(db, "ORDER");
}
