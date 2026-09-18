/**
 * Pricing engine assertions. Run with: npm run test:pricing
 *
 * Deliberately dependency-free so it runs under tsx without a test runner;
 * swap to Vitest when the suite grows past this file.
 */
import {
  calculateOrder,
  dealerDiscountPctNumber,
  discountedRate,
  CASH_DISCOUNT_PCT,
} from "../pricing";
import type { OrderLineDraft } from "../order-draft";

const L = (
  key: string,
  unitPrice: string,
  qty: number,
  gstRatePct: string,
): OrderLineDraft => ({
  key,
  oemId: "o",
  oemName: "OEM",
  vehicleId: "v",
  vehicleName: "Vehicle",
  partId: "p",
  partNo: "PN",
  partName: "Part",
  partColourId: "pc",
  colour: "Black",
  productCode: "CODE",
  packingUnit: "PC",
  qty,
  unitPrice,
  gstRatePct,
  remarks: "",
});

let pass = 0;
let fail = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  if (String(actual) === String(expected)) {
    pass++;
    console.log(`  OK   ${label} = ${actual}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}: got ${actual}, want ${expected}`);
  }
}

console.log("single line, no discount, 18% GST, Credit");
{
  const t = calculateOrder([L("a", "100.00", 10, "18")], {
    dealerDiscountPct: "0",
    paymentMode: "CREDIT",
  });
  eq("gross", t.gross, "1000");
  eq("net", t.net, "1000");
  eq("gst", t.gstAmount, "180");
  eq("total", t.total, "1180");
  eq("cashDiscount", t.cashDiscountAmt, "0");
}

console.log("10% dealer discount, Credit (no cash discount)");
{
  const t = calculateOrder([L("a", "100.00", 10, "18")], {
    dealerDiscountPct: "10",
    paymentMode: "CREDIT",
  });
  eq("dealerDiscount", t.dealerDiscountAmt, "100");
  eq("net", t.net, "900");
  eq("gst", t.gstAmount, "162");
  eq("total", t.total, "1062");
}

console.log("mixed GST slabs, no discount, Credit");
{
  const t = calculateOrder(
    [L("a", "100.00", 10, "18"), L("b", "200.00", 5, "28")],
    { dealerDiscountPct: "0", paymentMode: "CREDIT" },
  );
  eq("gross", t.gross, "2000");
  eq("gst", t.gstAmount, "460");
  eq("total", t.total, "2460");
}

// The reason discounts are apportioned per line rather than applied to the
// order total: each line must be taxed at its own slab on its own net value.
console.log("mixed GST slabs WITH dealer discount, Credit");
{
  const t = calculateOrder(
    [L("a", "100.00", 10, "18"), L("b", "200.00", 5, "28")],
    { dealerDiscountPct: "10", paymentMode: "CREDIT" },
  );
  eq("net", t.net, "1800");
  eq("gst", t.gstAmount, "414");
  eq("total", t.total, "2214");
}

console.log("Advance: 4% cash discount on post-dealer-discount value, per line");
{
  // Gross 1000, dealer 50% -> 500, cash 4% of 500 = 20 -> net 480.
  const t = calculateOrder([L("a", "100.00", 10, "18")], {
    dealerDiscountPct: "50",
    paymentMode: "ADVANCE",
  });
  eq("dealerDiscount", t.dealerDiscountAmt, "500");
  eq("cashDiscount", t.cashDiscountAmt, "20");
  eq("net", t.net, "480");
  eq("cash discount pct constant", CASH_DISCOUNT_PCT, "4");
}

console.log("Advance cash discount applies identically per line, not combined once");
{
  const t = calculateOrder(
    [L("a", "100.00", 10, "18"), L("b", "200.00", 5, "28")],
    { dealerDiscountPct: "50", paymentMode: "ADVANCE" },
  );
  // Line a: gross 1000, dealer 500 -> 500, cash 4% of 500 = 20
  // Line b: gross 1000, dealer 500 -> 500, cash 4% of 500 = 20
  eq("cashDiscount total", t.cashDiscountAmt, "40");
  eq("line a cash cut", t.lines[0].cashDiscountAmt, "20");
  eq("line b cash cut", t.lines[1].cashDiscountAmt, "20");
}

console.log("Credit never applies the cash discount, even at high dealer %");
{
  const t = calculateOrder([L("a", "100.00", 10, "18")], {
    dealerDiscountPct: "50",
    paymentMode: "CREDIT",
  });
  eq("cashDiscount", t.cashDiscountAmt, "0");
}

console.log("no payment mode selected yet: no cash discount");
{
  const t = calculateOrder([L("a", "100.00", 10, "18")], {
    dealerDiscountPct: "50",
    paymentMode: null,
  });
  eq("cashDiscount", t.cashDiscountAmt, "0");
}

console.log("discount cannot drive a line negative");
{
  const t = calculateOrder([L("a", "100.00", 1, "18")], {
    dealerDiscountPct: "150",
    paymentMode: "CREDIT",
  });
  eq("net >= 0", t.net.gte(0), "true");
}

console.log("rounding happens once, at line level");
{
  const t = calculateOrder([L("a", "33.333", 3, "18")], {
    dealerDiscountPct: "0",
    paymentMode: "CREDIT",
  });
  eq("gross", t.gross, "100");
}

console.log("dealerDiscountPctNumber — used against the Admin band");
{
  eq("50", dealerDiscountPctNumber("50"), 50);
  eq("50.5", dealerDiscountPctNumber("50.5"), 50.5);
  eq("empty", dealerDiscountPctNumber(""), 0);
  eq("garbage", dealerDiscountPctNumber("abc"), 0);
}

console.log("empty order");
{
  const t = calculateOrder([], { dealerDiscountPct: "10", paymentMode: "CREDIT" });
  eq("total", t.total, "0");
  eq("qty", t.totalQty, 0);
}

console.log("malformed input is treated as zero, never throws");
{
  const t = calculateOrder([L("a", "abc", 5, "xyz")], {
    dealerDiscountPct: "!!",
    paymentMode: "ADVANCE",
  });
  eq("total", t.total, "0");
}

// The Proforma Invoice prints Rate = MRP − dealer discount, and never shows
// the dealer cut separately. Everything on that document multiplies out from
// this figure, so it has to be exact.
console.log("discountedRate — the Rate printed on the PI");
{
  eq("no discount leaves MRP", discountedRate("196", "0"), "196");
  eq("10% of 250", discountedRate("250", "10"), "225");
  eq("rounds half up to 2dp", discountedRate("196.55", "7.5"), "181.81");
  eq("empty pct is 0%", discountedRate("196", ""), "196");
  eq("garbage pct is 0%", discountedRate("196", "abc"), "196");
  eq("garbage price is 0", discountedRate("abc", "10"), "0");
}

console.log("calculateOrder exposes rate per line");
{
  const t = calculateOrder([L("a", "250", 4, "18")], {
    dealerDiscountPct: "10",
    paymentMode: "CREDIT",
  });
  eq("line rate", t.lines[0].rate, "225");
  // gross stays MRP-based; only the printed Rate nets the dealer discount.
  eq("gross is still MRP x qty", t.lines[0].gross, "1000");
  eq("net matches rate x qty", t.lines[0].net, "900");
}

console.log("PI arithmetic reconciles — real sample line");
{
  // Sample invoice: 235 pcs, Rate 196.00, 4% cash discount -> 44,217.60
  const rate = discountedRate("196", "0");
  const beforeCash = Number(rate.mul(235).toFixed(2));
  const amount = Number((beforeCash * 0.96).toFixed(2));
  eq("before cash discount", beforeCash, 46060);
  eq("after 4% cash discount", amount, 44217.6);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
