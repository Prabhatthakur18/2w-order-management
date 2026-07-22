import Decimal from "decimal.js";
import type { OrderLineDraft } from "@/lib/order-draft";

/**
 * Pricing engine — TECH_STACK.md §4B.
 *
 *   Unit Price x Qty          = Gross
 *   - Dealer Discount
 *   - Scheme Discount         = Net (before GST)
 *   + GST (per-item slab)     = Total
 *
 * Rules:
 *  - Decimal throughout; never a JS float.
 *  - Rounding applied once at line level, then summed. Never rounded twice.
 */

const MONEY_DP = 2;

function money(v: Decimal): Decimal {
  return v.toDecimalPlaces(MONEY_DP, Decimal.ROUND_HALF_UP);
}

export type LineTotals = {
  key: string;
  gross: Decimal;
  discountAmt: Decimal;
  net: Decimal;
  gstAmount: Decimal;
  total: Decimal;
};

export type OrderTotals = {
  lines: LineTotals[];
  totalQty: number;
  gross: Decimal;
  dealerDiscountAmt: Decimal;
  schemeDiscountAmt: Decimal;
  net: Decimal;
  gstAmount: Decimal;
  total: Decimal;
};

export type DiscountInput = {
  dealerDiscountPct: string;
  schemeDiscountPct?: string;
  schemeFlatAmount?: string;
};

/**
 * Discounts apply proportionally across lines so each line's GST is computed
 * on its own discounted value — GST slabs differ per item, so discounting the
 * order total and taxing afterwards would produce the wrong tax.
 */
export function calculateOrder(
  lines: OrderLineDraft[],
  discounts: DiscountInput,
): OrderTotals {
  const dealerPct = safeDecimal(discounts.dealerDiscountPct);
  const schemePct = safeDecimal(discounts.schemeDiscountPct ?? "0");
  const schemeFlat = safeDecimal(discounts.schemeFlatAmount ?? "0");

  // Gross first — needed to apportion any flat scheme amount.
  const grossByLine = lines.map((l) =>
    money(safeDecimal(l.unitPrice).mul(new Decimal(l.qty))),
  );
  const grossTotal = grossByLine.reduce(
    (a, b) => a.add(b),
    new Decimal(0),
  );

  const lineTotals: LineTotals[] = [];
  let dealerDiscountTotal = new Decimal(0);
  let schemeDiscountTotal = new Decimal(0);

  lines.forEach((line, i) => {
    const gross = grossByLine[i];

    const dealerCut = money(gross.mul(dealerPct).div(100));

    // Percentage scheme applies to the post-dealer-discount value.
    const afterDealer = gross.sub(dealerCut);
    let schemeCut = money(afterDealer.mul(schemePct).div(100));

    // Flat scheme amount is shared out in proportion to line value.
    if (schemeFlat.gt(0) && grossTotal.gt(0)) {
      const share = money(schemeFlat.mul(gross).div(grossTotal));
      schemeCut = schemeCut.add(share);
    }

    const discountAmt = dealerCut.add(schemeCut);
    const net = money(Decimal.max(gross.sub(discountAmt), new Decimal(0)));
    const gstAmount = money(net.mul(safeDecimal(line.gstRatePct)).div(100));

    dealerDiscountTotal = dealerDiscountTotal.add(dealerCut);
    schemeDiscountTotal = schemeDiscountTotal.add(schemeCut);

    lineTotals.push({
      key: line.key,
      gross,
      discountAmt,
      net,
      gstAmount,
      total: net.add(gstAmount),
    });
  });

  const net = lineTotals.reduce((a, l) => a.add(l.net), new Decimal(0));
  const gstAmount = lineTotals.reduce(
    (a, l) => a.add(l.gstAmount),
    new Decimal(0),
  );

  return {
    lines: lineTotals,
    totalQty: lines.reduce((a, l) => a + l.qty, 0),
    gross: grossTotal,
    dealerDiscountAmt: dealerDiscountTotal,
    schemeDiscountAmt: schemeDiscountTotal,
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

/** Combined discount %, used against the Admin-configured cap. */
export function combinedDiscountPct(totals: OrderTotals): Decimal {
  if (totals.gross.lte(0)) return new Decimal(0);
  return totals.dealerDiscountAmt
    .add(totals.schemeDiscountAmt)
    .mul(100)
    .div(totals.gross);
}

export { Decimal };
