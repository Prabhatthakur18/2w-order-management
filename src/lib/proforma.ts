import "server-only";
import type { Prisma } from "@prisma/client";
import { formatINR, formatDate } from "@/lib/utils";

/**
 * Proforma Invoice — rendered at runtime from live order state and streamed
 * to the response. Never written to disk or stored in the database
 * (TECH_STACK.md §4A). Only the PI *number* persists.
 *
 * Deliberately a plain HTML document: the browser's own print-to-PDF handles
 * output, so there is no headless-Chromium dependency. Swap the markup when
 * the real invoice format arrives — nothing else needs to change.
 */

type OrderForPi = Prisma.OrderGetPayload<{
  include: {
    dealer: true;
    subDealer: true;
    scheme: true;
    lines: true;
    createdBy: { select: { name: true } };
  };
}>;

const COMPANY = {
  name: "Autoform India",
  addressLines: ["Registered Office", "India"],
  gstin: "—",
};

export function renderProformaInvoice(order: OrderForPi): string {
  const shipTo = order.shippingSameAsDealer
    ? `${order.dealer.address}, ${order.dealer.city}, ${order.dealer.state} — ${order.dealer.pincode}`
    : [
        order.shippingAddress,
        order.shippingCity,
        order.shippingState,
        order.shippingPincode,
      ]
        .filter(Boolean)
        .join(", ");

  const rows = order.lines
    .map(
      (l, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>
          <div class="strong">${esc(l.description)}</div>
          <div class="muted mono">${esc(l.productCode)}</div>
          ${l.remarks ? `<div class="muted italic">${esc(l.remarks)}</div>` : ""}
        </td>
        <td class="num">${l.qty} ${l.packingUnit}</td>
        <td class="num">${formatINR(l.unitPrice.toString())}</td>
        <td class="num">${formatINR(l.lineGross.toString())}</td>
        <td class="num">${Number(l.discountAmt) > 0 ? "− " + formatINR(l.discountAmt.toString()) : "—"}</td>
        <td class="num">${l.gstRatePct.toString()}%</td>
        <td class="num">${formatINR(l.gstAmount.toString())}</td>
        <td class="num strong">${formatINR(
          (Number(l.lineNet) + Number(l.gstAmount)).toFixed(2),
        )}</td>
      </tr>`,
    )
    .join("");

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
    color: #16233a; margin: 0; padding: 24px; background: #f6f8fb;
  }
  .sheet {
    max-width: 900px; margin: 0 auto; background: #fff; padding: 32px;
    border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,.06);
  }
  header { display: flex; justify-content: space-between; gap: 24px;
    border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: -.01em; }
  .doc-title { font-size: 13px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: #2563eb; }
  .meta { text-align: right; font-size: 12px; }
  .meta div { margin-bottom: 2px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .label { font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: #64748b; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; text-align: left; padding: 8px; font-size: 10px;
    text-transform: uppercase; letter-spacing: .06em; color: #475569;
    border-bottom: 1px solid #e2e8f0; }
  td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  th.num { text-align: right; }
  .strong { font-weight: 600; }
  .muted { color: #64748b; font-size: 11px; }
  .mono { font-family: ui-monospace, monospace; }
  .italic { font-style: italic; }
  .totals { margin-left: auto; margin-top: 16px; width: 300px; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { border-top: 2px solid #16233a; margin-top: 6px; padding-top: 10px;
    font-size: 16px; font-weight: 700; }
  footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0;
    font-size: 11px; color: #64748b; }
  .actions { max-width: 900px; margin: 0 auto 14px; text-align: right; }
  button { font: inherit; font-size: 13px; font-weight: 600; padding: 9px 16px;
    border-radius: 8px; border: 0; background: #2563eb; color: #fff; cursor: pointer; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; padding: 0; max-width: none; }
    .actions { display: none; }
  }
</style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="sheet">
    <header>
      <div>
        <h1>${esc(COMPANY.name)}</h1>
        <div class="muted">${COMPANY.addressLines.map(esc).join("<br>")}</div>
        <div class="muted">GSTIN: ${esc(COMPANY.gstin)}</div>
      </div>
      <div class="meta">
        <div class="doc-title">Proforma Invoice</div>
        <div class="strong mono">${esc(order.piNumber ?? "—")}</div>
        <div class="muted">Order ${esc(order.orderNo)}</div>
        <div class="muted">${formatDate(order.piIssuedAt ?? order.createdAt)}</div>
      </div>
    </header>

    <div class="grid">
      <div class="box">
        <div class="label">Bill to</div>
        <div class="strong">${esc(order.dealer.name)}</div>
        <div class="muted">${esc(order.dealer.address)}, ${esc(order.dealer.city)},
          ${esc(order.dealer.state)} — ${esc(order.dealer.pincode)}</div>
        <div class="muted">Contact: ${esc(order.dealer.contactNo)}</div>
        ${order.dealer.gstin ? `<div class="muted">GSTIN: ${esc(order.dealer.gstin)}</div>` : ""}
      </div>
      <div class="box">
        <div class="label">Ship to</div>
        ${order.subDealer ? `<div class="strong">${esc(order.subDealer.name)}</div>` : ""}
        <div class="muted">${esc(shipTo)}</div>
        <div class="muted">Payment: ${order.paymentMode === "CREDIT" ? "Credit" : "Advance"}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="num">#</th><th>Item</th><th class="num">Qty</th>
          <th class="num">Rate</th><th class="num">Gross</th><th class="num">Discount</th>
          <th class="num">GST</th><th class="num">Tax</th><th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div><span>Gross</span><span>${formatINR(order.grossValue.toString())}</span></div>
      ${
        Number(order.dealerDiscountAmt) > 0
          ? `<div><span>Dealer discount (${order.dealerDiscountPct ?? 0}%)</span><span>− ${formatINR(order.dealerDiscountAmt.toString())}</span></div>`
          : ""
      }
      ${
        Number(order.schemeDiscountAmt) > 0
          ? `<div><span>Scheme${order.scheme ? " — " + esc(order.scheme.name) : ""}</span><span>− ${formatINR(order.schemeDiscountAmt.toString())}</span></div>`
          : ""
      }
      <div><span>Net (before GST)</span><span>${formatINR(order.netValue.toString())}</span></div>
      <div><span>GST</span><span>${formatINR(order.gstAmount.toString())}</span></div>
      <div class="grand"><span>Total</span><span>${formatINR(order.totalValue.toString())}</span></div>
    </div>

    ${order.remarks ? `<div class="box" style="margin-top:20px"><div class="label">Remarks</div><div>${esc(order.remarks)}</div></div>` : ""}

    <footer>
      This is a proforma invoice and not a tax invoice. Generated on
      ${formatDate(new Date())} by ${esc(order.createdBy.name)}.
      Values are indicative until the tax invoice is issued.
    </footer>
  </div>
</body>
</html>`;
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
