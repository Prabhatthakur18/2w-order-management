/**
 * Pricing engine assertions. Run with: npm run test:pricing
 *
 * Deliberately dependency-free so it runs under tsx without a test runner;
 * swap to Vitest when the suite grows past this file.
 */
import { calculateOrder, combinedDiscountPct } from "../pricing";
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

console.log("single line, no discount, 18% GST");
{
  const t = calculateOrder([L("a", "100.00", 10, "18")], {
    dealerDiscountPct: "0",
  });
  eq("gross", t.gross, "1000");
  eq("net", t.net, "1000");
  eq("gst", t.gstAmount, "180");
  eq("total", t.total, "1180");
}

console.log("10% dealer discount");
{
  const t = calculateOrder([L("a", "100.00", 10, "18")], {
    dealerDiscountPct: "10",
  });
  eq("dealerDiscount", t.dealerDiscountAmt, "100");
  eq("net", t.net, "900");
  eq("gst", t.gstAmount, "162");
  eq("total", t.total, "1062");
}

console.log("mixed GST slabs, no discount");
{
  const t = calculateOrder(
    [L("a", "100.00", 10, "18"), L("b", "200.00", 5, "28")],
    { dealerDiscountPct: "0" },
  );
  eq("gross", t.gross, "2000");
  eq("gst", t.gstAmount, "460");
  eq("total", t.total, "2460");
}

// The reason discounts are apportioned per line rather than applied to the
// order total: each line must be taxed at its own slab on its own net value.
console.log("mixed GST slabs WITH discount");
{
  const t = calculateOrder(
    [L("a", "100.00", 10, "18"), L("b", "200.00", 5, "28")],
    { dealerDiscountPct: "10" },
  );
  eq("net", t.net, "1800");
  eq("gst", t.gstAmount, "414");
  eq("total", t.total, "2214");
}

console.log("flat scheme apportioned by line value");
{
  const t = calculateOrder(
    [L("a", "100.00", 10, "18"), L("b", "100.00", 10, "18")],
    { dealerDiscountPct: "0", schemeFlatAmount: "200" },
  );
  eq("schemeDiscount", t.schemeDiscountAmt, "200");
  eq("net", t.net, "1800");
}

console.log("discount cannot drive a line negative");
{
  const t = calculateOrder([L("a", "100.00", 1, "18")], {
    dealerDiscountPct: "150",
  });
  eq("net >= 0", t.net.gte(0), "true");
}

console.log("rounding happens once, at line level");
{
  const t = calculateOrder([L("a", "33.333", 3, "18")], {
    dealerDiscountPct: "0",
  });
  eq("gross", t.gross, "100");
}

console.log("combined discount percentage");
{
  const t = calculateOrder([L("a", "100.00", 10, "18")], {
    dealerDiscountPct: "10",
    schemeDiscountPct: "5",
  });
  eq("combined", combinedDiscountPct(t).toFixed(2), "14.50");
}

console.log("empty order");
{
  const t = calculateOrder([], { dealerDiscountPct: "10" });
  eq("total", t.total, "0");
  eq("qty", t.totalQty, 0);
}

console.log("malformed input is treated as zero, never throws");
{
  const t = calculateOrder([L("a", "abc", 5, "xyz")], {
    dealerDiscountPct: "!!",
  });
  eq("total", t.total, "0");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
