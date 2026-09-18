"use client";

import { CreditCard, TriangleAlert, Wallet } from "lucide-react";
import type { OrderDraft } from "@/lib/order-draft";
import { CASH_DISCOUNT_PCT, dealerDiscountPctNumber, type OrderTotals } from "@/lib/pricing";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { formatINR, cn } from "@/lib/utils";
import type { SchemeOption, WizardConfig } from "./types";

/**
 * Module 2/3 — payment mode, dealer discount, scheme (label only), remarks,
 * and the resulting order value. GST is intentionally not shown here — this
 * section is the dealer-facing commercial value before tax.
 */
export function StepTerms({
  draft,
  schemes,
  config,
  totals,
  onChange,
}: {
  draft: OrderDraft;
  schemes: SchemeOption[];
  config: WizardConfig;
  totals: OrderTotals;
  onChange: (patch: Partial<OrderDraft>) => void;
}) {
  const minPct = Number(config.minDealerPct);
  const maxPct = Number(config.maxDealerPct);
  const discountNum = dealerDiscountPctNumber(draft.dealerDiscountPct);
  const outOfBand =
    draft.dealerDiscountPct !== "" &&
    discountNum > 0 &&
    (discountNum < minPct || discountNum > maxPct);

  const creditDaysNum = Number(draft.creditDays);
  const creditDaysInvalid =
    draft.paymentMode === "CREDIT" &&
    draft.creditDays !== "" &&
    (creditDaysNum <= 0 || creditDaysNum > 45);

  return (
    <div className="space-y-4">
      <Card>
        <h4 className="mb-3 text-sm font-bold">Payment mode</h4>
        <div className="grid grid-cols-2 gap-3">
          <PaymentOption
            selected={draft.paymentMode === "CREDIT"}
            onClick={() => onChange({ paymentMode: "CREDIT" })}
            icon={<CreditCard className="h-5 w-5" />}
            label="Credit"
            hint="Credit limit in days"
          />
          <PaymentOption
            selected={draft.paymentMode === "ADVANCE"}
            onClick={() => onChange({ paymentMode: "ADVANCE" })}
            icon={<Wallet className="h-5 w-5" />}
            label="Advance"
            hint={`${CASH_DISCOUNT_PCT}% cash discount`}
          />
        </div>

        {draft.paymentMode === "CREDIT" ? (
          <div className="mt-3">
            <Field
              label="Credit limit (days)"
              htmlFor="credit-days"
              required
              hint="Maximum 45 days."
              error={
                creditDaysInvalid
                  ? "Enter a value between 1 and 45 days."
                  : undefined
              }
            >
              <Input
                id="credit-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={45}
                step={1}
                placeholder="e.g. 30"
                value={draft.creditDays}
                onChange={(e) => onChange({ creditDays: e.target.value })}
              />
            </Field>
          </div>
        ) : null}
      </Card>

      <Card>
        <Field
          label="Dealer discount %"
          htmlFor="discount"
          hint={`Normal range is ${config.minDealerPct}%–${config.maxDealerPct}%.`}
        >
          <Input
            id="discount"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            value={draft.dealerDiscountPct}
            onChange={(e) => onChange({ dealerDiscountPct: e.target.value })}
          />
        </Field>
      </Card>

      <Card>
        <Field label="Scheme" htmlFor="scheme" hint="Optional — for reference only.">
          <Combobox
            options={schemes.map((s) => ({ value: s.id, label: s.name }))}
            value={draft.schemeId}
            onChange={(v) => onChange({ schemeId: v })}
            placeholder="No scheme"
            searchPlaceholder="Search schemes…"
          />
        </Field>
      </Card>

      {outOfBand ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs font-medium text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {discountNum}% is outside the {config.minDealerPct}%–{config.maxDealerPct}%
          range. The order will still be created, but will be flagged for
          Admin approval.
        </p>
      ) : null}

      <Card>
        <Field label="Remarks" htmlFor="remarks">
          <Textarea
            id="remarks"
            placeholder="Anything the production or accounts team should know"
            value={draft.remarks}
            onChange={(e) => onChange({ remarks: e.target.value })}
          />
        </Field>
      </Card>

      {/* Dealer-facing order value — before GST, per business direction. */}
      <Card>
        <h4 className="mb-3 text-sm font-bold">Order value</h4>
        <dl className="space-y-2 text-sm">
          <Row label="Gross" value={formatINR(totals.gross.toString())} />
          {totals.dealerDiscountAmt.gt(0) ? (
            <Row
              label={`Dealer discount (${draft.dealerDiscountPct}%)`}
              value={`− ${formatINR(totals.dealerDiscountAmt.toString())}`}
              tone="muted"
            />
          ) : null}
          {totals.cashDiscountAmt.gt(0) ? (
            <Row
              label={`Cash discount (${CASH_DISCOUNT_PCT}%)`}
              value={`− ${formatINR(totals.cashDiscountAmt.toString())}`}
              tone="muted"
            />
          ) : null}
          <div className="border-t border-border pt-2">
            <Row
              label="Order value"
              value={formatINR(totals.net.toString())}
              bold
            />
          </div>
        </dl>
      </Card>
    </div>
  );
}

function PaymentOption({
  selected,
  onClick,
  icon,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-2xl border p-4 transition-all duration-300 active:scale-95",
        selected
          ? "border-primary bg-primary/5 text-primary shadow-sm shadow-primary/10"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {icon}
      <span className="text-sm font-bold">{label}</span>
      <span className="text-center text-[10px] uppercase tracking-wider">
        {hint}
      </span>
    </button>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt
        className={
          tone === "muted" ? "text-muted-foreground" : "text-foreground"
        }
      >
        {label}
      </dt>
      <dd
        className={`tabular-nums ${bold ? "text-base font-bold" : "font-medium"}`}
      >
        {value}
      </dd>
    </div>
  );
}
