"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import type { PackingUnit } from "@prisma/client";
import { orderDraftSchema, type OrderLineDraft } from "@/lib/order-draft";
import { calculateOrder, combinedDiscountPct } from "@/lib/pricing";
import { getCurrentPrice, getDiscountRule } from "@/lib/catalog";

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNo: string }
  | { ok: false; error: string };

/**
 * Creates the order. Every client-side check is repeated here — prices are
 * re-resolved from the database rather than trusted from the payload, and
 * discount caps are re-enforced. The client is treated as untrusted input.
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

  const dealer = await db.dealer.findFirst({
    where: { id: draft.dealerId, isActive: true },
  });
  if (!dealer) return { ok: false, error: "That dealer is not available." };

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

  // Re-enforce the Admin-configured discount rules (Report Rec #4).
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

  const orderNo = await nextOrderNumber();

  try {
    const order = await db.$transaction(async (tx) => {
      // Sub-dealer created inline is flagged unverified for Admin review.
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

      const created = await tx.order.create({
        data: {
          orderNo,
          status: "DRAFT",
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
          toValue: { orderNo, status: "DRAFT", total: totals.total.toString() },
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
  const fy = financialYear(new Date());

  const seq = await db.documentSequence.upsert({
    where: { docType_financialYear: { docType: "ORDER", financialYear: fy } },
    update: { lastNumber: { increment: 1 } },
    create: {
      docType: "ORDER",
      financialYear: fy,
      prefix: `ORDER/${fy}/`,
      lastNumber: 1,
    },
  });

  return `${seq.prefix}${String(seq.lastNumber).padStart(5, "0")}`;
}

/** Indian financial year: April to March. */
function financialYear(d: Date): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}
