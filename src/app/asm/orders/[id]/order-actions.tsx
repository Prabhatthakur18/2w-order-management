"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button, Card } from "@/components/ui";
import { formatRemaining } from "@/lib/order-window";
import { placeOrderNow, cancelOrder } from "../actions";

/**
 * Action panel for an order still inside its edit window: a live countdown,
 * place-now, and cancel. Once the window closes the order auto-places.
 */
export function OrderActions({
  orderId,
  editableUntilMs,
  editWindowHours,
}: {
  orderId: string;
  editableUntilMs: number;
  editWindowHours: number;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, editableUntilMs - Date.now()),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, editableUntilMs - Date.now());
      setRemaining(next);
      // Window just closed — refresh so the server places the order.
      if (next === 0) router.refresh();
    };
    tick();
    // Every 15s: the ring animates smoothly between ticks, and the minute
    // readout stays accurate without a per-second timer.
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, [editableUntilMs, router]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setConfirmCancel(false);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  const totalMs = editWindowHours * 3600_000;
  const elapsed = Math.min(1, Math.max(0, 1 - remaining / totalMs));
  // Ring geometry: r=20 gives a 22px-radius dial at 48px square.
  const circumference = 2 * Math.PI * 20;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-3.5">
        <div className="relative h-12 w-12 shrink-0">
          <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" aria-hidden>
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="3.5"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="hsl(var(--status-created))"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * elapsed}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <Clock
            className="absolute inset-0 m-auto h-4 w-4 text-status-created"
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold leading-tight">
            {formatRemaining(remaining)}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Editable for {editWindowHours}h, then placed automatically.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          className="w-full"
          disabled={pending || remaining <= 0}
          onClick={() => run(() => placeOrderNow(orderId))}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Place order now
        </Button>

        {!confirmCancel ? (
          <Button
            variant="ghost"
            className="w-full"
            disabled={pending || remaining <= 0}
            onClick={() => setConfirmCancel(true)}
          >
            <X className="h-4 w-4" />
            Cancel order
          </Button>
        ) : (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="mb-2.5 text-sm font-medium">
              Cancel this order? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                disabled={pending}
                onClick={() => run(() => cancelOrder(orderId))}
              >
                Yes, cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                disabled={pending}
                onClick={() => setConfirmCancel(false)}
              >
                Keep it
              </Button>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </Card>
  );
}

/** PI is available only once the order is placed and a number allocated. */
export function ProformaButton({ orderId }: { orderId: string }) {
  return (
    <a
      href={`/asm/orders/${orderId}/proforma`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition-all duration-300 hover:bg-muted active:scale-95"
    >
      <FileText className="h-4 w-4" />
      Download proforma invoice
    </a>
  );
}

/** Plain order record — available at any status, unlike the PI. */
export function OrderPdfButton({ orderId }: { orderId: string }) {
  return (
    <a
      href={`/asm/orders/${orderId}/pdf`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition-all duration-300 hover:bg-muted active:scale-95"
    >
      <FileText className="h-4 w-4" />
      Download order PDF
    </a>
  );
}
