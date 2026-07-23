import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { OrderStatus, Prisma } from "@prisma/client";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard";
import { ButtonLink, EmptyState } from "@/components/ui";
import { OrderRow } from "@/components/order-row";
import { cn } from "@/lib/utils";
import { sweepExpiredOrders } from "@/lib/order-lifecycle";

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

      <nav className="mb-5 flex gap-1 rounded-2xl border border-border bg-muted/60 p-1 shadow-xs">
        {TABS.map((t) => (
          <Link
            key={t.slug}
            href={`/asm/orders?tab=${t.slug}`}
            aria-current={tab === t.slug ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-[0.07em] transition-all duration-200",
              tab === t.slug
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span
              className={cn(
                "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                tab === t.slug
                  ? "bg-primary text-primary-foreground"
                  : "bg-border/60 text-muted-foreground",
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
          {orders.map((o) => (
            <OrderRow
              key={o.id}
              href={`/asm/orders/${o.id}`}
              orderNo={o.orderNo}
              dealerName={o.dealer.name}
              status={o.status}
              createdAt={o.createdAt}
              totalQty={o.totalQty}
              totalValue={o.totalValue.toString()}
              piNumber={o.piNumber}
              editableUntil={o.editableUntil}
            />
          ))}
        </div>
      )}
    </>
  );
}
