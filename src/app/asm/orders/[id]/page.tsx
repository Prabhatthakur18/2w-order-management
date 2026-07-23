import { notFound } from "next/navigation";
import { CheckCircle2, Mail, MessageCircle } from "lucide-react";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard";
import { ButtonLink, Card } from "@/components/ui";
import { formatINR, formatDate } from "@/lib/utils";
import { STATUS_LABEL, STATUS_RAIL } from "@/lib/order-status";
import {
  getEditWindowHours,
  isEditable,
  sweepExpiredOrders,
} from "@/lib/order-lifecycle";
import { OrderActions, OrderPdfButton, ProformaButton } from "./order-actions";
import { PaymentReceiptCard } from "./payment-receipt-card";

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

  // Place this order if its window has expired, before rendering.
  await sweepExpiredOrders();
  const editWindowHours = await getEditWindowHours();

  const order = await db.order.findFirst({
    // An ASM can only open their own orders.
    where: isAdmin ? { id } : { id, createdById: session.user.id },
    include: {
      dealer: true,
      subDealer: true,
      scheme: true,
      lines: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true } },
      dealerNotifications: { orderBy: { createdAt: "desc" } },
      payments: {
        where: { mode: "ADVANCE" },
        include: { receipts: { orderBy: { uploadedAt: "desc" } } },
      },
    },
  });

  if (!order) notFound();

  const editable = isEditable(order);

  return (
    <>
      <PageHeader title={order.orderNo} subtitle={order.dealer.name} />

      {created ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Order created. You can still edit it before it is placed.
        </p>
      ) : null}

      <div className="space-y-4">
        {editable ? (
          <>
            <OrderActions
              orderId={order.id}
              editableUntilMs={order.editableUntil!.getTime()}
              editWindowHours={editWindowHours}
            />
            <ButtonLink
              href={`/asm/orders/${order.id}/edit`}
              variant="secondary"
              className="w-full"
            >
              Edit order
            </ButtonLink>
          </>
        ) : null}

        {order.piNumber ? (
          <Card>
            <div className="mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Proforma invoice
              </p>
              <p className="font-mono text-sm font-semibold">
                {order.piNumber}
              </p>
              {order.autoPlaced ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Placed automatically when the edit window closed.
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ProformaButton orderId={order.id} />
              <OrderPdfButton orderId={order.id} />
            </div>
          </Card>
        ) : (
          <Card>
            <OrderPdfButton orderId={order.id} />
          </Card>
        )}

        {order.dealerNotifications.length > 0 ? (
          <Card>
            <h4 className="mb-2.5 text-sm font-bold">Dealer notified</h4>
            <div className="space-y-1.5">
              {order.dealerNotifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  {n.channel === "EMAIL" ? (
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="flex-1">
                    {n.channel === "EMAIL" ? "Email" : "WhatsApp"} logged ·{" "}
                    {formatDate(n.createdAt)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              For the dealer&apos;s records — no action required from them.
            </p>
          </Card>
        ) : null}

        {order.paymentMode === "ADVANCE" && order.piNumber ? (
          <PaymentReceiptCard
            orderId={order.id}
            receipts={order.payments.flatMap((p) =>
              p.receipts.map((r) => ({
                id: r.id,
                fileAssetId: r.fileAssetId,
                uploadedAt: r.uploadedAt,
              })),
            )}
          />
        ) : null}

        <Card
          className="rail"
          style={
            { "--rail-color": STATUS_RAIL[order.status] } as React.CSSProperties
          }
        >
          <div className="flex items-center justify-between gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{
                background: `${STATUS_RAIL[order.status]}1a`,
                color: STATUS_RAIL[order.status],
              }}
            >
              {STATUS_LABEL[order.status]}
            </span>
            <time
              dateTime={order.createdAt.toISOString()}
              className="text-xs text-muted-foreground"
            >
              {formatDate(order.createdAt)}
            </time>
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
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <dt className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Total
              </dt>
              <dd className="font-display text-2xl font-semibold tabular-nums">
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
