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
