import Decimal from "decimal.js";
import type { OrderLineDraft } from "@/lib/order-draft";

/**
 * Pricing engine.
 *
 *   Unit Price x Qty              = Gross
 *   - Dealer Discount (per line)
 *   - Cash Discount 4% (Advance only, per line, on the post-dealer-discount
 *     value)                      = Net (before GST)
 *   + GST (per-item slab)         = Total
 *
 * Scheme is a selectable label only — it has no effect on cost (business
 * direction). It is still recorded on the order for reference.
 *
 * Rules:
 *  - Decimal throughout; never a JS float.
 *  - Rounding applied once at line level, then summed. Never rounded twice.
 *  - The dealer discount is applied identically per line — there is no
 *    order-level "combined discount" concept anymore.
 */

export const CASH_DISCOUNT_PCT = "4";

const MONEY_DP = 2;

function money(v: Decimal): Decimal {
  return v.toDecimalPlaces(MONEY_DP, Decimal.ROUND_HALF_UP);
}

export type LineTotals = {
  key: string;
  /** Per-unit price after the dealer discount — what the PI prints as "Rate". */
  rate: Decimal;
  gross: Decimal;
  discountAmt: Decimal;
  cashDiscountAmt: Decimal;
  net: Decimal;
  gstAmount: Decimal;
  total: Decimal;
};

export type OrderTotals = {
  lines: LineTotals[];
  totalQty: number;
  gross: Decimal;
  dealerDiscountAmt: Decimal;
  cashDiscountAmt: Decimal;
  net: Decimal;
  gstAmount: Decimal;
  total: Decimal;
};

export type PricingInput = {
  dealerDiscountPct: string;
  /** Advance payment applies the 4% cash discount per line; Credit does not. */
  paymentMode: "CREDIT" | "ADVANCE" | null;
};

/**
 * Per-unit price after the dealer discount — the "Rate" printed on the
 * Proforma Invoice. The dealer discount never appears on that document; it
 * is folded into this figure instead, so the only visible discount there is
 * the cash discount.
 *
 * Exported because two callers need it from different sources: the PI reads
 * persisted OrderLine rows, the review step reads live draft lines.
 */
export function discountedRate(
  unitPrice: string | number | null | undefined,
  dealerDiscountPct: string | number | null | undefined,
): Decimal {
  const price = safeDecimal(unitPrice);
  const pct = safeDecimal(dealerDiscountPct);
  return money(price.sub(price.mul(pct).div(100)));
}

export function calculateOrder(
  lines: OrderLineDraft[],
  input: PricingInput,
): OrderTotals {
  const dealerPct = safeDecimal(input.dealerDiscountPct);
  const cashPct = input.paymentMode === "ADVANCE" ? safeDecimal(CASH_DISCOUNT_PCT) : new Decimal(0);

  const lineTotals: LineTotals[] = [];
  let dealerDiscountTotal = new Decimal(0);
  let cashDiscountTotal = new Decimal(0);

  lines.forEach((line) => {
    const gross = money(safeDecimal(line.unitPrice).mul(new Decimal(line.qty)));

    const dealerCut = money(gross.mul(dealerPct).div(100));
    const afterDealer = gross.sub(dealerCut);

    // Cash discount is 4% of the post-dealer-discount value, per line.
    const cashCut = money(afterDealer.mul(cashPct).div(100));

    const discountAmt = dealerCut.add(cashCut);
    const net = money(Decimal.max(gross.sub(discountAmt), new Decimal(0)));
    const gstAmount = money(net.mul(safeDecimal(line.gstRatePct)).div(100));

    dealerDiscountTotal = dealerDiscountTotal.add(dealerCut);
    cashDiscountTotal = cashDiscountTotal.add(cashCut);

    lineTotals.push({
      key: line.key,
      rate: discountedRate(line.unitPrice, input.dealerDiscountPct),
      gross,
      discountAmt: dealerCut,
      cashDiscountAmt: cashCut,
      net,
      gstAmount,
      total: net.add(gstAmount),
    });
  });

  const gross = lineTotals.reduce((a, l) => a.add(l.gross), new Decimal(0));
  const net = lineTotals.reduce((a, l) => a.add(l.net), new Decimal(0));
  const gstAmount = lineTotals.reduce(
    (a, l) => a.add(l.gstAmount),
    new Decimal(0),
  );

  return {
    lines: lineTotals,
    totalQty: lines.reduce((a, l) => a + l.qty, 0),
    gross,
    dealerDiscountAmt: dealerDiscountTotal,
    cashDiscountAmt: cashDiscountTotal,
    net,
    gstAmount,
    total: net.add(gstAmount),
  };
}

function safeDecimal(v: string | number | null | undefined): Decimal {
  if (v === null || v === undefined || v === "") return new Decimal(0);
  try {
    const d = new Decimal(v);
    return d.isFinite() ? d : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

/** Dealer discount % as a plain number, checked against the Admin band. */
export function dealerDiscountPctNumber(pct: string): number {
  const d = safeDecimal(pct);
  return Number(d.toFixed(2));
}

export { Decimal };
