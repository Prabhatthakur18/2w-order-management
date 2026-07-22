"use client";

import { TriangleAlert } from "lucide-react";
import type { OrderDraft } from "@/lib/order-draft";
import { combinedDiscountPct, type OrderTotals } from "@/lib/pricing";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { formatINR } from "@/lib/utils";
import type { SchemeOption, WizardConfig } from "./types";

/**
 * Module 2 — discount, scheme and remarks, with the Admin-configured cap
 * enforced live (Report Rec #4). Server-side validation repeats this on submit.
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
  const combined = combinedDiscountPct(totals);
  const maxPct = Number(config.maxCombinedPct);
  const approvalPct = Number(config.approvalAbovePct);
  const combinedNum = Number(combined.toFixed(2));

  const overCap = combinedNum > maxPct;
  const needsApproval = !overCap && combinedNum > approvalPct;

  const scheme = schemes.find((s) => s.id === draft.schemeId);
  const stackingBlocked =
    !config.allowStacking &&
    Number(draft.dealerDiscountPct) > 0 &&
    Boolean(draft.schemeId);

  return (
    <div className="space-y-4">
      <Card>
        <Field
          label="Dealer discount %"
          htmlFor="discount"
          hint={`Maximum combined discount is ${config.maxCombinedPct}%.`}
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
        <Field
          label="Scheme"
          htmlFor="scheme"
          hint={
            config.allowStacking
              ? "Applies on top of the dealer discount."
              : "Cannot be combined with a dealer discount."
          }
        >
          <Select
            id="scheme"
            value={draft.schemeId}
            onChange={(e) => onChange({ schemeId: e.target.value })}
          >
            <option value="">No scheme</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.discountPct ? ` (${s.discountPct}%)` : ""}
                {s.flatAmount ? ` (${formatINR(s.flatAmount)})` : ""}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {stackingBlocked ? (
        <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Dealer discount and scheme cannot be applied together. Remove one to
          continue.
        </p>
      ) : null}

      {overCap ? (
        <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Combined discount is {combinedNum}%, above the {config.maxCombinedPct}%
          cap. This order will be rejected on submission.
        </p>
      ) : null}

      {needsApproval ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs font-medium text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Combined discount is {combinedNum}%, above the {config.approvalAbovePct}
          % threshold. Admin approval will be required.
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

      {/* Live calculation chain — TECH_STACK.md §4B */}
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
          {totals.schemeDiscountAmt.gt(0) ? (
            <Row
              label={`Scheme${scheme ? ` — ${scheme.name}` : ""}`}
              value={`− ${formatINR(totals.schemeDiscountAmt.toString())}`}
              tone="muted"
            />
          ) : null}
          <Row
            label="Net (before GST)"
            value={formatINR(totals.net.toString())}
          />
          <Row label="GST" value={formatINR(totals.gstAmount.toString())} />
          <div className="border-t border-border pt-2">
            <Row
              label="Total"
              value={formatINR(totals.total.toString())}
              bold
            />
          </div>
        </dl>
      </Card>
    </div>
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
