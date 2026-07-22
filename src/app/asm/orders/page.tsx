import Link from "next/link";
import { ClipboardList, Clock } from "lucide-react";
import type { OrderStatus, Prisma } from "@prisma/client";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { STATUS_TONE, STATUS_LABEL } from "@/lib/order-status";
import {
  sweepExpiredOrders,
  msRemaining,
  formatRemaining,
} from "@/lib/order-lifecycle";

const TABS = [
  { slug: "created", label: "Created" },
  { slug: "placed", label: "Placed" },
  { slug: "all", label: "All" },
] as const;

type TabSlug = (typeof TABS)[number]["slug"];

function filterFor(tab: TabSlug): Prisma.OrderWhereInput {
  if (tab === "created") return { status: { in: ["DRAFT", "CREATED"] } };
  if (tab === "placed") {
    const placed: OrderStatus[] = [
      "PLACED",
      "PENDING_APPROVAL",
      "APPROVED",
      "IN_PRODUCTION",
      "READY_FOR_DISPATCH",
      "INVOICED",
      "DISPATCHED",
      "CLOSED",
    ];
    return { status: { in: placed } };
  }
  return {};
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireRole(["ASM", "ADMIN"]);

  // Advance any expired edit windows before reading, so the tabs are accurate.
  await sweepExpiredOrders();

  const { tab: rawTab } = await searchParams;
  const tab: TabSlug = TABS.some((t) => t.slug === rawTab)
    ? (rawTab as TabSlug)
    : "created";

  const isAdmin = session.user.roles.includes("ADMIN");
  const scope: Prisma.OrderWhereInput = isAdmin
    ? {}
    : { createdById: session.user.id };

  const [orders, createdCount, placedCount, allCount] = await Promise.all([
    db.order.findMany({
      where: { ...scope, ...filterFor(tab) },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { dealer: { select: { name: true } } },
    }),
    db.order.count({ where: { ...scope, ...filterFor("created") } }),
    db.order.count({ where: { ...scope, ...filterFor("placed") } }),
    db.order.count({ where: scope }),
  ]);

  const counts: Record<TabSlug, number> = {
    created: createdCount,
    placed: placedCount,
    all: allCount,
  };

  return (
    <>
      <PageHeader
        title="Orders"
        action={{ href: "/asm/orders/new", label: "New order" }}
      />

      <nav className="mb-4 flex gap-1.5 rounded-2xl bg-muted p-1">
        {TABS.map((t) => (
          <Link
            key={t.slug}
            href={`/asm/orders?tab=${t.slug}`}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all",
              tab === t.slug
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px]",
                tab === t.slug
                  ? "bg-primary/10 text-primary"
                  : "bg-card/60 text-muted-foreground",
              )}
            >
              {counts[t.slug]}
            </span>
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title={
            tab === "created"
              ? "No orders awaiting placement"
              : tab === "placed"
                ? "No placed orders yet"
                : "No orders yet"
          }
          description={
            tab === "created"
              ? "New orders stay here while they can still be edited."
              : "Placed orders move here once committed."
          }
          action={
            tab !== "placed" ? (
              <ButtonLink href="/asm/orders/new">Create an order</ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2.5">
          {orders.map((o) => {
            const remaining = msRemaining(o.editableUntil);
            const showTimer = o.status === "CREATED" && remaining > 0;
            return (
              <Link key={o.id} href={`/asm/orders/${o.id}`} className="block">
                <Card className="card-hover">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {o.orderNo}
                      </p>
                      <p className="mt-0.5 truncate font-semibold">
                        {o.dealer.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(o.createdAt)} · {o.totalQty} units
                      </p>
                      {showTimer ? (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-warning">
                          <Clock className="h-3 w-3" />
                          {formatRemaining(remaining)}
                        </p>
                      ) : null}
                      {o.piNumber ? (
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {o.piNumber}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone={STATUS_TONE[o.status]}>
                        {STATUS_LABEL[o.status]}
                      </Badge>
                      <p className="mt-1.5 font-bold tabular-nums">
                        {formatINR(o.totalValue.toString())}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
