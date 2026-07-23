import Link from "next/link";
import { Clock } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { formatINR, formatDate } from "@/lib/utils";
import { STATUS_LABEL, STATUS_RAIL } from "@/lib/order-status";
import { formatRemaining } from "@/lib/order-window";

/**
 * One order in a list. The left rail encodes status as position and colour,
 * so a column of these is scannable as a pattern — you find the order you
 * want by shape, not by reading each line.
 */
export function OrderRow({
  href,
  orderNo,
  dealerName,
  status,
  createdAt,
  totalQty,
  totalValue,
  piNumber,
  editableUntil,
}: {
  href: string;
  orderNo: string;
  dealerName: string;
  status: OrderStatus;
  createdAt: Date;
  totalQty: number;
  totalValue: string;
  piNumber?: string | null;
  editableUntil?: Date | null;
}) {
  const rail = STATUS_RAIL[status];
  const remaining = editableUntil
    ? Math.max(0, editableUntil.getTime() - Date.now())
    : 0;
  const showTimer = status === "CREATED" && remaining > 0;

  return (
    <Link href={href} className="group block">
      <article
        className="rail relative rounded-2xl border border-border bg-card p-4 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
        style={{ "--rail-color": rail } as React.CSSProperties}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
                style={{ background: `${rail}1a`, color: rail }}
              >
                {STATUS_LABEL[status]}
              </span>
              <time
                dateTime={createdAt.toISOString()}
                className="text-[11px] text-muted-foreground"
              >
                {formatDate(createdAt)}
              </time>
            </div>

            <p className="mt-2 truncate font-semibold leading-snug transition-colors group-hover:text-primary">
              {dealerName}
            </p>

            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {piNumber ?? orderNo}
            </p>

            {showTimer ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-status-created/10 px-2 py-1 text-[11px] font-semibold text-status-created">
                <Clock className="h-3 w-3" />
                {formatRemaining(remaining)}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 text-right">
            <p className="font-display text-lg font-semibold leading-none tabular-nums">
              {formatINR(totalValue)}
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {totalQty} {totalQty === 1 ? "unit" : "units"}
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}
