import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { formatINR, formatDate } from "@/lib/utils";
import { STATUS_TONE, STATUS_LABEL } from "@/lib/order-status";

export default async function OrdersPage() {
  const session = await requireRole(["ASM", "ADMIN"]);
  const isAdmin = session.user.roles.includes("ADMIN");

  const orders = await db.order.findMany({
    // An ASM sees their own orders; Admin sees everything.
    where: isAdmin ? {} : { createdById: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { dealer: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${orders.length} order${orders.length === 1 ? "" : "s"}`}
        action={{ href: "/asm/orders/new", label: "New order" }}
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No orders yet"
          description="Create your first order to see it here."
          action={
            <ButtonLink href="/asm/orders/new">Create an order</ButtonLink>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {orders.map((o) => (
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
          ))}
        </div>
      )}
    </>
  );
}
