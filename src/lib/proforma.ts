import "server-only";
import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { formatINR, formatDate } from "@/lib/utils";
import { amountInWords } from "@/lib/number-to-words";
import { discountedRate, CASH_DISCOUNT_PCT } from "@/lib/pricing";

/**
 * Proforma Invoice — rendered at runtime from live order state and streamed
 * to the response. Never written to disk or stored in the database
 * (TECH_STACK.md §4A). Only the PI *number* persists.
 *
 * Deliberately a plain HTML document: the browser's own print-to-PDF handles
 * output, so there is no headless-Chromium dependency.
 *
 * Figures follow the trade format this business actually uses:
 *
 *   Rate    = unit price − dealer discount %   (the dealer cut is NOT shown
 *             anywhere on this document — it is folded into Rate)
 *   Amount  = Rate × Qty − cash discount 4%    (cash discount on Advance only)
 *   Total   = Σ Amount + GST
 *
 * The printed Rate is authoritative: every figure on the page multiplies out
 * exactly, so a dealer checking the arithmetic by hand always reconciles.
 * That means these totals are recomputed here rather than read from
 * Order.netValue/totalValue, and can differ from those stored values by a
 * few paise.
 */

type OrderForPi = Prisma.OrderGetPayload<{
  include: {
    dealer: true;
    subDealer: true;
    printingFrame: true;
    lines: true;
    createdBy: { select: { name: true } };
  };
}>;

export type PiCompany = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  gstin: string;
  stateName: string;
  email: string;
  pan: string;
};

/** Used when SystemConfig has no row for a field. */
export const DEFAULT_PI_COMPANY: PiCompany = {
  name: "A V ENTERPRISES",
  addressLine1: "C-2/2/2 2ND FLOOR UPSIDC INDUSTRIAL AREA",
  addressLine2: "CENTRAL HOPE TOWN SELAQUI DEHRADUN-248011",
  gstin: "05ABOFA2141B1Z2",
  stateName: "Uttarakhand",
  email: "srnaccounts@autoformindia.com",
  pan: "ABOFA2141B",
};

export function renderProformaInvoice(
  order: OrderForPi,
  company: PiCompany = DEFAULT_PI_COMPANY,
): string {
  const isAdvance = order.paymentMode === "ADVANCE";
  const cashPct = isAdvance ? new Decimal(CASH_DISCOUNT_PCT) : new Decimal(0);

  const shipToLines = order.shippingSameAsDealer
    ? [
        `${order.dealer.address}`,
        `${order.dealer.city}, ${order.dealer.state} — ${order.dealer.pincode}`,
      ]
    : [
        order.shippingAddress ?? "",
        [order.shippingCity, order.shippingState, order.shippingPincode]
          .filter(Boolean)
          .join(", "),
      ].filter(Boolean);

  let taxable = new Decimal(0);
  let taxTotal = new Decimal(0);
  let qtyTotal = new Decimal(0);

  const rows = order.lines
    .map((l, i) => {
      const rate = discountedRate(
        l.unitPrice.toString(),
        order.dealerDiscountPct?.toString() ?? "0",
      );
      const beforeCash = rate.mul(l.qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const cashCut = beforeCash
        .mul(cashPct)
        .div(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const amount = beforeCash.sub(cashCut);
      const tax = amount
        .mul(new Decimal(l.gstRatePct.toString()))
        .div(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      taxable = taxable.add(amount);
      taxTotal = taxTotal.add(tax);
      qtyTotal = qtyTotal.add(l.qty);

      return `
      <tr>
        <td class="num">${i + 1}</td>
        <td>
          <div class="strong">${esc(l.description)}</div>
          <div class="muted italic">${esc(l.productCode)}</div>
        </td>
        <td class="num">${esc(l.gstRatePct.toString())} %</td>
        <td class="num">${esc(l.qty.toString())}.00 ${esc(l.packingUnit)}</td>
        <td class="num">${fmt(rate)}</td>
        <td class="num">${isAdvance ? `${esc(CASH_DISCOUNT_PCT)} %` : ""}</td>
        <td class="num strong">${fmt(amount)}</td>
      </tr>`;
    })
    .join("");

  // Invoiced amount is a whole rupee; the paise are shown as their own
  // Round off line so the arithmetic on the page still reconciles.
  const beforeRounding = taxable.add(taxTotal);
  const grandTotal = beforeRounding.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const roundOff = grandTotal.sub(beforeRounding);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proforma Invoice ${esc(order.piNumber ?? order.orderNo)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #111; margin: 0; padding: 24px; background: #f4f5f7; font-size: 12px;
  }
  .sheet { max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #000; }
  .title { text-align: center; font-weight: 700; font-size: 13px; padding: 6px;
    border-bottom: 1px solid #000; letter-spacing: .04em; }
  .split { display: grid; grid-template-columns: 1fr 1fr; }
  .split > div + div { border-left: 1px solid #000; }
  .cell { padding: 8px 10px; }
  .rowline { border-bottom: 1px solid #000; }
  .label { font-size: 10px; color: #444; }
  .strong { font-weight: 700; }
  .muted { color: #555; font-size: 11px; }
  .italic { font-style: italic; }
  .kv { display: grid; grid-template-columns: 1fr 1fr; }
  .kv > div { padding: 6px 10px; border-bottom: 1px solid #000; }
  .kv > div:nth-child(even) { border-left: 1px solid #000; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th { background: #f0f0f0; text-align: left; padding: 6px 8px; font-size: 10px;
    text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #000;
    border-top: 1px solid #000; }
  td { padding: 6px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  th.num { text-align: right; }
  .totals { display: flex; justify-content: flex-end; }
  .totals table { width: auto; min-width: 320px; }
  .totals td { border: 0; padding: 4px 10px; }
  .totals tr.grand td { border-top: 1px solid #000; font-weight: 700; font-size: 13px;
    padding-top: 7px; }
  .words { padding: 8px 10px; border-top: 1px solid #000; border-bottom: 1px solid #000; }
  .decl { display: grid; grid-template-columns: 1fr 1fr; }
  .decl > div { padding: 10px; }
  .decl > div + div { border-left: 1px solid #000; text-align: right; }
  .sign { margin-top: 42px; font-size: 11px; }
  .foot { text-align: center; font-size: 10px; color: #555; padding: 6px; }
  .actions { max-width: 900px; margin: 0 auto 14px; text-align: right; }
  button { font: inherit; font-size: 13px; font-weight: 600; padding: 9px 16px;
    border-radius: 8px; border: 0; background: #2563eb; color: #fff; cursor: pointer; }
  @media print {
    body { background: #fff; padding: 0; font-size: 11px; }
    .sheet { border: 1px solid #000; max-width: none; }
    .actions { display: none; }
  }
</style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="sheet">
    <div class="title">PROFORMA INVOICE</div>

    <div class="split rowline">
      <div class="cell">
        <div class="strong">${esc(company.name)}</div>
        <div class="muted">${esc(company.addressLine1)}</div>
        <div class="muted">${esc(company.addressLine2)}</div>
        <div class="muted">GSTIN/UIN: ${esc(company.gstin)}</div>
        <div class="muted">State Name : ${esc(company.stateName)}</div>
        <div class="muted">E-Mail : ${esc(company.email)}</div>
      </div>
      <div>
        <div class="kv">
          <div>
            <div class="label">Invoice No.</div>
            <div class="strong">${esc(order.piNumber ?? "—")}</div>
          </div>
          <div>
            <div class="label">Dated</div>
            <div class="strong">${formatDate(order.piIssuedAt ?? order.createdAt)}</div>
          </div>
          <div>
            <div class="label">Mode/Terms of Payment</div>
            <div class="strong">${order.paymentMode === "CREDIT" ? `Credit${order.creditDays ? ` — ${order.creditDays} Days` : ""}` : "Advance"}</div>
          </div>
          <div>
            <div class="label">Order No.</div>
            <div class="strong">${esc(order.orderNo)}</div>
          </div>
          <div style="grid-column: 1 / -1; border-bottom: 0;">
            <div class="label">Printing Frame</div>
            <div class="strong">${esc(printingFrameText(order.printingFrame))}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="split rowline">
      <div class="cell">
        <div class="label">Consignee (Ship to)</div>
        <div class="strong">${esc(order.subDealer?.name ?? order.dealer.name)}</div>
        ${shipToLines.map((line) => `<div class="muted">${esc(line)}</div>`).join("")}
        <div class="muted">MOB-${esc(order.dealer.contactNo)}</div>
        ${order.subDealer?.gstin || order.dealer.gstin ? `<div class="muted">GSTIN/UIN : ${esc(order.subDealer?.gstin ?? order.dealer.gstin)}</div>` : ""}
        <div class="muted">State Name : ${esc(order.shippingSameAsDealer ? order.dealer.state : (order.shippingState ?? order.dealer.state))}</div>
      </div>
      <div class="cell">
        <div class="label">Buyer (Bill to)</div>
        <div class="strong">${esc(order.dealer.name)}</div>
        <div class="muted">${esc(order.dealer.address)}</div>
        <div class="muted">${esc(order.dealer.city)}, ${esc(order.dealer.state)} — ${esc(order.dealer.pincode)}</div>
        <div class="muted">MOB-${esc(order.dealer.contactNo)}</div>
        ${order.dealer.gstin ? `<div class="muted">GSTIN/UIN : ${esc(order.dealer.gstin)}</div>` : ""}
        <div class="muted">State Name : ${esc(order.dealer.state)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="num">Sl</th>
          <th>Description of Goods</th>
          <th class="num">GST</th>
          <th class="num">Quantity</th>
          <th class="num">Rate</th>
          <th class="num">Disc. %</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td></td>
          <td class="strong">Total</td>
          <td></td>
          <td class="num strong">${esc(qtyTotal.toString())}.00</td>
          <td></td>
          <td></td>
          <td class="num strong">${fmt(taxable)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="totals">
      <table>
        <tr><td>Taxable value</td><td class="num">${fmt(taxable)}</td></tr>
        <tr><td>GST</td><td class="num">${fmt(taxTotal)}</td></tr>
        ${
          roundOff.isZero()
            ? ""
            : `<tr><td>Round off</td><td class="num">${roundOff.isNegative() ? "" : "+"}${fmt(roundOff)}</td></tr>`
        }
        <tr class="grand"><td>Total</td><td class="num">${formatINR(grandTotal.toString())}</td></tr>
      </table>
    </div>

    <div class="words">
      <div class="label">Amount Chargeable (in words)</div>
      <div class="strong">${esc(amountInWords(grandTotal.toString()))}</div>
    </div>

    ${order.remarks ? `<div class="cell rowline"><div class="label">Remarks</div><div>${esc(order.remarks)}</div></div>` : ""}

    <div class="decl">
      <div>
        <div class="muted">Company's PAN : <span class="strong">${esc(company.pan)}</span></div>
        <div class="label" style="margin-top:8px">Declaration</div>
        <div class="muted">
          We declare that this invoice shows the actual price of the goods
          described and that all particulars are true and correct.
        </div>
      </div>
      <div>
        <div class="strong">for ${esc(company.name)}</div>
        <div class="sign">Authorised Signatory</div>
      </div>
    </div>

    <div class="foot">
      This is a Computer Generated Invoice · generated ${formatDate(new Date())}
      by ${esc(order.createdBy.name)}
    </div>
  </div>
</body>
</html>`;
}

/**
 * What to print for the printing frame. An artwork file can't be reproduced
 * on an invoice and its internal label ("UID_REF_02") means nothing to the
 * dealer, so image frames just say so. Typed content is the instruction
 * itself, so it prints.
 */
function printingFrameText(frame: OrderForPi["printingFrame"]): string {
  if (!frame) return "—";
  if (frame.mode === "IMAGE") return "Image attached";
  const text = (frame.contentText ?? "").trim();
  if (!text) return "Content attached";
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

/** Plain 2dp with thousands separators — the table shows bare figures, no ₹. */
function fmt(v: Decimal): string {
  const [whole, decimals] = v.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}.${decimals}`;
}

/** Order data is user-supplied; escape everything interpolated into HTML. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
