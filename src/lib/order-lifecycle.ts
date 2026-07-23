import "server-only";
import { db } from "@/lib/db";
import { notifyDealerOrderPlaced } from "@/lib/dealer-notify";
import {
  DEFAULT_EDIT_WINDOW_HOURS,
  editDeadline,
  financialYear,
  formatRemaining,
  isEditable,
  msRemaining,
} from "@/lib/order-window";

/**
 * Order lifecycle — the ASM's edit window.
 *
 *   DRAFT ──create──> CREATED ──┬── ASM places early ──> PLACED
 *                               └── window expires ────> PLACED (auto)
 *
 * While CREATED the ASM may edit the order. Once PLACED it is committed, a
 * Proforma Invoice number is allocated, and the dealer is notified.
 *
 * The dealer is informational-only here — they receive the order by email
 * and WhatsApp for their records, but do not approve or act on it. There is
 * no approval gate in this flow.
 */

export const EDIT_WINDOW_HOURS_KEY = "order.edit_window_hours";

// Pure helpers live in order-window.ts so client components can import them
// without pulling in server-only code.
export {
  DEFAULT_EDIT_WINDOW_HOURS,
  editDeadline,
  isEditable,
  msRemaining,
  formatRemaining,
  financialYear,
};

export async function getEditWindowHours(): Promise<number> {
  const row = await db.systemConfig.findUnique({
    where: { key: EDIT_WINDOW_HOURS_KEY },
  });
  const parsed = Number(row?.value);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_EDIT_WINDOW_HOURS;
}

/**
 * Allocates the next number for a document type. The number persists on the
 * order; the document itself is always generated at runtime.
 */
export async function allocateDocNumber(
  tx: Pick<typeof db, "documentSequence">,
  docType: string,
  when = new Date(),
): Promise<string> {
  const fy = financialYear(when);
  const seq = await tx.documentSequence.upsert({
    where: { docType_financialYear: { docType, financialYear: fy } },
    update: { lastNumber: { increment: 1 } },
    create: {
      docType,
      financialYear: fy,
      prefix: `${docType}/${fy}/`,
      lastNumber: 1,
    },
  });
  return `${seq.prefix}${String(seq.lastNumber).padStart(5, "0")}`;
}

export type PlaceResult =
  | { ok: true; piNumber: string; autoPlaced: boolean }
  | { ok: false; error: string };

/**
 * Moves an order to PLACED and allocates its PI number.
 *
 * The status guard sits inside the update's where clause, so two concurrent
 * calls (an ASM pressing Place at the moment the sweep runs) cannot both
 * succeed — the second matches no rows.
 */
export async function placeOrder(
  orderId: string,
  actorId: string | null,
  auto: boolean,
): Promise<PlaceResult> {
  try {
    return await db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: "CREATED" },
        data: {
          status: "PLACED",
          placedAt: new Date(),
          placedById: actorId,
          autoPlaced: auto,
        },
      });

      if (claimed.count === 0) {
        return { ok: false as const, error: "This order is no longer pending." };
      }

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          piNumber: true,
          orderNo: true,
          dealerId: true,
          totalValue: true,
        },
      });

      // Re-placing must never mint a second number.
      let piNumber = order.piNumber;
      if (!piNumber) {
        piNumber = await allocateDocNumber(tx, "PI");
        await tx.order.update({
          where: { id: orderId },
          data: { piNumber, piIssuedAt: new Date() },
        });
      }

      // Dealer is informational-only — no approval gate in this flow.
      await notifyDealerOrderPlaced(tx, {
        orderId,
        dealerId: order.dealerId,
        orderNo: order.orderNo,
        piNumber,
        totalValue: order.totalValue.toString(),
      });

      await tx.auditLog.create({
        data: {
          entityType: "Order",
          entityId: orderId,
          action: auto ? "AUTO_PLACED" : "PLACED",
          toValue: { status: "PLACED", piNumber },
          actorId,
        },
      });

      return { ok: true as const, piNumber, autoPlaced: auto };
    });
  } catch (err) {
    console.error("placeOrder failed", err);
    return { ok: false, error: "Could not place the order. Try again." };
  }
}

/**
 * Places every CREATED order whose window has expired.
 *
 * Called opportunistically on ASM page loads so the lifecycle advances without
 * a scheduler. A real cron job should also call this once Phase 7 lands, so
 * orders still confirm when nobody opens the app.
 */
export async function sweepExpiredOrders(): Promise<number> {
  const due = await db.order.findMany({
    where: { status: "CREATED", editableUntil: { lte: new Date() } },
    select: { id: true },
    take: 100,
  });

  let placed = 0;
  for (const o of due) {
    const result = await placeOrder(o.id, null, true);
    if (result.ok) placed++;
  }
  return placed;
}
