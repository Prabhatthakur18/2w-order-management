import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Dealer notifications — the flowchart's "Send Email to Dealer" step.
 *
 * The dealer only needs to know the order was placed; they do not approve
 * or act on it (confirmed with the business — no approval gate here).
 *
 * Every call today just LOGS the notification — no WhatsApp or email
 * provider is wired up yet. This is the frame the business asked for: the
 * trigger point, the data model, and the UI showing notification status.
 * Wiring a real sender later means writing to `status`/`sentAt` from a
 * queue job; nothing about where this is called from changes.
 */

type Tx = PrismaClient | Prisma.TransactionClient;

export async function notifyDealerOrderPlaced(
  tx: Tx,
  params: {
    orderId: string;
    dealerId: string;
    orderNo: string;
    piNumber: string;
    totalValue: string;
  },
) {
  const message = `Order ${params.orderNo} (${params.piNumber}) has been placed. Total: ₹${params.totalValue}.`;

  await tx.dealerNotification.createMany({
    data: [
      {
        orderId: params.orderId,
        dealerId: params.dealerId,
        channel: "EMAIL",
        event: "ORDER_PLACED",
        message,
      },
      {
        orderId: params.orderId,
        dealerId: params.dealerId,
        channel: "WHATSAPP",
        event: "ORDER_PLACED",
        message,
      },
    ],
  });
}
