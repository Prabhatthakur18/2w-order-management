import { z } from "zod";

/**
 * Client-side order draft. Persisted to localStorage so a dropped connection
 * never loses a half-entered order (mobile-first rule 6).
 *
 * Money is held as strings here and converted with Decimal for arithmetic —
 * never parsed into a float.
 */

export const orderLineSchema = z.object({
  key: z.string(),
  oemId: z.string().min(1),
  oemName: z.string(),
  vehicleId: z.string().min(1),
  vehicleName: z.string(),
  partId: z.string().min(1),
  partNo: z.string(),
  partName: z.string(),
  partColourId: z.string().min(1),
  colour: z.string(),
  productCode: z.string(),
  packingUnit: z.enum(["PC", "SET"]),
  qty: z.number().int().positive(),
  unitPrice: z.string(),
  gstRatePct: z.string(),
  // Per-item instruction for production/dispatch.
  remarks: z.string().max(500).default(""),
});

export type OrderLineDraft = z.infer<typeof orderLineSchema>;

export const orderDraftSchema = z.object({
  // Module 1 — parties & destination
  dealerId: z.string().default(""),
  subDealerId: z.string().default(""),
  newSubDealer: z
    .object({
      name: z.string(),
      address: z.string(),
      contactNo: z.string(),
    })
    .nullable()
    .default(null),
  printingFrameId: z.string().default(""),
  shippingSameAsDealer: z.boolean().default(true),
  shippingAddress: z.string().default(""),
  shippingCity: z.string().default(""),
  shippingState: z.string().default(""),
  shippingPincode: z.string().default(""),

  // Module 2 — configuration & commercials
  lines: z.array(orderLineSchema).default([]),
  dealerDiscountPct: z.string().default("0"),
  schemeId: z.string().default(""),
  remarks: z.string().default(""),

  // Module 3 — payment
  paymentMode: z.enum(["CREDIT", "ADVANCE"]).nullable().default(null),

  updatedAt: z.string().default(() => new Date().toISOString()),
});

export type OrderDraft = z.infer<typeof orderDraftSchema>;

export const emptyDraft: OrderDraft = {
  dealerId: "",
  subDealerId: "",
  newSubDealer: null,
  printingFrameId: "",
  shippingSameAsDealer: true,
  shippingAddress: "",
  shippingCity: "",
  shippingState: "",
  shippingPincode: "",
  lines: [],
  dealerDiscountPct: "0",
  schemeId: "",
  remarks: "",
  paymentMode: null,
  updatedAt: new Date().toISOString(),
};

export const DRAFT_STORAGE_KEY = "twom.order.draft.v1";

export function loadDraft(): OrderDraft {
  if (typeof window === "undefined") return emptyDraft;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return emptyDraft;
    const parsed = orderDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyDraft;
  } catch {
    return emptyDraft;
  }
}

export function saveDraft(draft: OrderDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Storage full or blocked — the draft simply is not persisted.
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Wizard steps ──

export const STEPS = [
  { id: 1, slug: "parties", label: "Dealer", title: "Dealer & destination" },
  { id: 2, slug: "items", label: "Items", title: "Product configuration" },
  { id: 3, slug: "terms", label: "Terms", title: "Discount & commercial terms" },
  { id: 4, slug: "review", label: "Review", title: "Payment & review" },
] as const;

export type StepSlug = (typeof STEPS)[number]["slug"];

/** Which steps have enough data to be considered complete. */
export function stepStatus(draft: OrderDraft) {
  const parties = Boolean(draft.dealerId);
  const items = draft.lines.length > 0;
  const terms = items;
  const review = items && draft.paymentMode !== null;
  return { parties, items, terms, review };
}
