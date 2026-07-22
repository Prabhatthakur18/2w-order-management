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
    const timer = setInterval(tick, 30_000);
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

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-warning" />
        <div className="min-w-0">
          <p className="text-sm font-bold">{formatRemaining(remaining)}</p>
          <p className="text-xs text-muted-foreground">
            Edit freely for {editWindowHours}h. After that the order is placed
            automatically.
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
