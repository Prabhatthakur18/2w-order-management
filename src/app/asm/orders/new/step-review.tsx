"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Loader2, TriangleAlert, Wallet } from "lucide-react";
import type { OrderDraft } from "@/lib/order-draft";
import type { OrderTotals } from "@/lib/pricing";
import { Button, Card } from "@/components/ui";
import { formatINR, cn } from "@/lib/utils";
import { createOrder } from "./create-order";
import type { DealerOption, SchemeOption } from "./types";

/** Module 3 — payment mode, final review and order creation. */
export function StepReview({
  draft,
  dealers,
  schemes,
  totals,
  onChange,
  onSubmitted,
}: {
  draft: OrderDraft;
  dealers: DealerOption[];
  schemes: SchemeOption[];
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
        <h4 className="mb-3 text-sm font-bold">Payment mode</h4>
        <div className="grid grid-cols-2 gap-3">
          <PaymentOption
            selected={draft.paymentMode === "CREDIT"}
            onClick={() => onChange({ paymentMode: "CREDIT" })}
            icon={<CreditCard className="h-5 w-5" />}
            label="Credit"
            hint={
              dealer?.creditDays ? `${dealer.creditDays} days` : "On account"
            }
          />
          <PaymentOption
            selected={draft.paymentMode === "ADVANCE"}
            onClick={() => onChange({ paymentMode: "ADVANCE" })}
            icon={<Wallet className="h-5 w-5" />}
            label="Advance"
            hint="Paid upfront"
          />
        </div>
      </Card>

      <Card>
        <h4 className="mb-3 text-sm font-bold">Summary</h4>
        <dl className="space-y-2 text-sm">
          <SummaryRow label="Dealer" value={dealer?.name ?? "—"} />
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
          {scheme ? (
            <SummaryRow label="Scheme" value={scheme.name} />
          ) : null}
        </dl>
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
                  {l.partNo} — {l.colour}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.qty} {l.packingUnit} × {formatINR(l.unitPrice)}
                </p>
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
          {totals.schemeDiscountAmt.gt(0) ? (
            <SummaryRow
              label="Scheme discount"
              value={`− ${formatINR(totals.schemeDiscountAmt.toString())}`}
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
      <span className="text-[10px] uppercase tracking-wider">{hint}</span>
    </button>
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
