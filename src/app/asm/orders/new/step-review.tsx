"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, TriangleAlert, Truck } from "lucide-react";
import { lineDescription, type OrderDraft } from "@/lib/order-draft";
import { CASH_DISCOUNT_PCT, type OrderTotals } from "@/lib/pricing";
import { Button, Card } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { formatINR } from "@/lib/utils";
import { createOrder } from "./create-order";
import type { DealerOption, SchemeOption, TransporterOption } from "./types";

/** Final review: preferred transportation, full breakdown, and submission. */
export function StepReview({
  draft,
  dealers,
  schemes,
  transporters,
  totals,
  onChange,
  onSubmitted,
}: {
  draft: OrderDraft;
  dealers: DealerOption[];
  schemes: SchemeOption[];
  transporters: TransporterOption[];
  totals: OrderTotals;
  onChange: (patch: Partial<OrderDraft>) => void;
  onSubmitted: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dealer = dealers.find((d) => d.id === draft.dealerId);
  const scheme = schemes.find((s) => s.id === draft.schemeId);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createOrder(draft);
      if (result.ok) {
        onSubmitted();
        router.push(`/asm/orders/${result.orderId}?created=1`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <h4 className="mb-3 text-sm font-bold">Summary</h4>
        <dl className="space-y-2 text-sm">
          <SummaryRow label="Dealer" value={dealer?.name ?? "—"} />
          <SummaryRow
            label="Payment"
            value={
              draft.paymentMode === "CREDIT"
                ? `Credit — ${draft.creditDays || "—"} days`
                : draft.paymentMode === "ADVANCE"
                  ? `Advance (${CASH_DISCOUNT_PCT}% cash discount)`
                  : "—"
            }
          />
          <SummaryRow
            label="Shipping"
            value={
              draft.shippingSameAsDealer
                ? "Dealer address"
                : `${draft.shippingCity || "—"}${draft.shippingPincode ? ` — ${draft.shippingPincode}` : ""}`
            }
          />
          <SummaryRow label="Items" value={String(draft.lines.length)} />
          <SummaryRow label="Units" value={String(totals.totalQty)} />
          {scheme ? <SummaryRow label="Scheme" value={scheme.name} /> : null}
        </dl>
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-bold">Preferred transportation</h4>
        </div>
        <Combobox
          options={transporters.map((t) => ({
            value: t.id,
            label: t.name,
            meta: t.code,
          }))}
          value={draft.preferredTransporterId}
          onChange={(v) => onChange({ preferredTransporterId: v })}
          placeholder="Select a transporter"
          searchPlaceholder="Search transporters…"
        />
      </Card>

      <Card>
        <h4 className="mb-3 text-sm font-bold">Items</h4>
        <div className="space-y-2.5">
          {draft.lines.map((l, i) => (
            <div
              key={l.key}
              className="flex items-start justify-between gap-3 border-b border-border pb-2.5 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {lineDescription(l)}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {l.productCode}
                </p>
                {/* Rate, not MRP — the dealer discount is folded in, matching
                    what the Proforma Invoice prints. */}
                <p className="text-xs text-muted-foreground">
                  {l.qty} {l.packingUnit} ×{" "}
                  {formatINR(totals.lines[i]?.rate.toString() ?? l.unitPrice)}
                </p>
                {l.remarks ? (
                  <p className="mt-1 rounded-lg bg-muted/60 px-2 py-1 text-xs italic text-muted-foreground">
                    {l.remarks}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {formatINR(totals.lines[i]?.net.toString() ?? "0")}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <dl className="space-y-2 text-sm">
          <SummaryRow
            label="Gross"
            value={formatINR(totals.gross.toString())}
          />
          {totals.dealerDiscountAmt.gt(0) ? (
            <SummaryRow
              label="Dealer discount"
              value={`− ${formatINR(totals.dealerDiscountAmt.toString())}`}
            />
          ) : null}
          {totals.cashDiscountAmt.gt(0) ? (
            <SummaryRow
              label={`Cash discount (${CASH_DISCOUNT_PCT}%)`}
              value={`− ${formatINR(totals.cashDiscountAmt.toString())}`}
            />
          ) : null}
          <SummaryRow
            label="Net (before GST)"
            value={formatINR(totals.net.toString())}
          />
          <SummaryRow
            label="GST"
            value={formatINR(totals.gstAmount.toString())}
          />
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
            <dt className="font-bold">Total</dt>
            <dd className="text-lg font-bold tabular-nums">
              {formatINR(totals.total.toString())}
            </dd>
          </div>
        </dl>
      </Card>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button
        className="w-full"
        size="lg"
        disabled={pending || !draft.paymentMode || draft.lines.length === 0}
        onClick={submit}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating order…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Create order
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        The order is saved as a draft. Sending it for dealer approval comes in
        the next phase.
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}
