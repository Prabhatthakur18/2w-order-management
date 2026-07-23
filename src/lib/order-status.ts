import type { OrderStatus } from "@prisma/client";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  CREATED: "Created",
  PLACED: "Placed",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  DECLINED: "Declined",
  IN_PRODUCTION: "In production",
  READY_FOR_DISPATCH: "Ready",
  INVOICED: "Invoiced",
  DISPATCHED: "Dispatched",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

/**
 * Rail colour per status, drawn from the status axis in globals.css.
 * Kept separate from the accent so state never competes with actions.
 */
export const STATUS_RAIL: Record<OrderStatus, string> = {
  DRAFT: "hsl(var(--status-draft))",
  CREATED: "hsl(var(--status-created))",
  PLACED: "hsl(var(--status-placed))",
  PENDING_APPROVAL: "hsl(var(--status-created))",
  APPROVED: "hsl(var(--status-placed))",
  DECLINED: "hsl(var(--status-stopped))",
  IN_PRODUCTION: "hsl(var(--status-progress))",
  READY_FOR_DISPATCH: "hsl(var(--status-progress))",
  INVOICED: "hsl(var(--status-progress))",
  DISPATCHED: "hsl(var(--status-done))",
  CLOSED: "hsl(var(--status-done))",
  CANCELLED: "hsl(var(--status-stopped))",
};

export const STATUS_TONE: Record<
  OrderStatus,
  "neutral" | "primary" | "success" | "warning" | "danger"
> = {
  DRAFT: "neutral",
  CREATED: "warning",
  PLACED: "primary",
  PENDING_APPROVAL: "warning",
  APPROVED: "primary",
  DECLINED: "danger",
  IN_PRODUCTION: "primary",
  READY_FOR_DISPATCH: "primary",
  INVOICED: "primary",
  DISPATCHED: "success",
  CLOSED: "success",
  CANCELLED: "danger",
};
