import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard";
import { Badge, Card } from "@/components/ui";
import { formatINR, formatDate } from "@/lib/utils";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/order-status";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await requireRole(["ASM", "ADMIN"]);
  const { id } = await params;
  const { created } = await searchParams;
  const isAdmin = session.user.roles.includes("ADMIN");

  const order = await db.order.findFirst({
    // An ASM can only open their own orders.
    where: isAdmin ? { id } : { id, createdById: session.user.id },
    include: {
      dealer: true,
      subDealer: true,
      scheme: true,
      lines: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true } },
    },
  });

  if (!order) notFound();

  return (
    <>
      <PageHeader title={order.orderNo} subtitle={order.dealer.name} />

      {created ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Order created successfully.
        </p>
      ) : null}

      <div className="space-y-4">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <Badge tone={STATUS_TONE[order.status]}>
              {STATUS_LABEL[order.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(order.createdAt)}
            </span>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Dealer" value={order.dealer.name} />
            {order.subDealer ? (
              <Row label="Sub-dealer" value={order.subDealer.name} />
            ) : null}
            <Row
              label="Payment"
              value={order.paymentMode === "CREDIT" ? "Credit" : "Advance"}
            />
            <Row
              label="Shipping"
              value={
                order.shippingSameAsDealer
                  ? "Dealer address"
                  : [order.shippingAddress, order.shippingCity, order.shippingPincode]
                      .filter(Boolean)
                      .join(", ") || "—"
              }
            />
            <Row label="Created by" value={order.createdBy.name} />
          </dl>
        </Card>

        <Card>
          <h4 className="mb-3 text-sm font-bold">
            Items ({order.lines.length})
          </h4>
          <div className="space-y-2.5">
            {order.lines.map((l) => (
              <div
                key={l.id}
                className="border-b border-border pb-2.5 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {l.description}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {l.productCode}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {l.qty} {l.packingUnit} × {formatINR(l.unitPrice.toString())}
                      {" · GST "}
                      {l.gstRatePct.toString()}%
                    </p>
                    {l.remarks ? (
                      <p className="mt-1 rounded-lg bg-muted/60 px-2 py-1 text-xs italic text-muted-foreground">
                        {l.remarks}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatINR(l.lineNet.toString())}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <dl className="space-y-2 text-sm">
            <Row label="Gross" value={formatINR(order.grossValue.toString())} />
            {Number(order.dealerDiscountAmt) > 0 ? (
              <Row
                label={`Dealer discount (${order.dealerDiscountPct ?? 0}%)`}
                value={`− ${formatINR(order.dealerDiscountAmt.toString())}`}
              />
            ) : null}
            {Number(order.schemeDiscountAmt) > 0 ? (
              <Row
                label={`Scheme${order.scheme ? ` — ${order.scheme.name}` : ""}`}
                value={`− ${formatINR(order.schemeDiscountAmt.toString())}`}
              />
            ) : null}
            <Row
              label="Net (before GST)"
              value={formatINR(order.netValue.toString())}
            />
            <Row label="GST" value={formatINR(order.gstAmount.toString())} />
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
              <dt className="font-bold">Total</dt>
              <dd className="text-lg font-bold tabular-nums">
                {formatINR(order.totalValue.toString())}
              </dd>
            </div>
          </dl>
        </Card>

        {order.remarks ? (
          <Card>
            <h4 className="mb-1.5 text-sm font-bold">Remarks</h4>
            <p className="text-sm text-muted-foreground">{order.remarks}</p>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
