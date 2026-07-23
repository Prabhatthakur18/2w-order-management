import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import {
  PageHeader,
  PhaseNote,
  Section,
  StatGrid,
  StatTile,
} from "@/components/dashboard";
import { EmptyState, ButtonLink } from "@/components/ui";
import { OrderRow } from "@/components/order-row";
import { sweepExpiredOrders } from "@/lib/order-lifecycle";

export default async function AsmDashboard() {
  const session = await requireRole(["ASM", "ADMIN"]);
  const isAdmin = session.user.roles.includes("ADMIN");
  const scope = isAdmin ? {} : { createdById: session.user.id };

  await sweepExpiredOrders();

  const [created, placed, inProduction, dispatched, recent] = await Promise.all([
    db.order.count({ where: { ...scope, status: "CREATED" } }),
    db.order.count({ where: { ...scope, status: "PLACED" } }),
    db.order.count({ where: { ...scope, status: "IN_PRODUCTION" } }),
    db.order.count({ where: { ...scope, status: "DISPATCHED" } }),
    db.order.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { dealer: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="ASM dashboard"
        subtitle="Your orders, approvals and dealers"
        action={{ href: "/asm/orders/new", label: "New order" }}
      />

      <StatGrid>
        <StatTile
          label="Editable"
          value={created}
          tone="warn"
          hint="Still inside the edit window"
          attention
        />
        <StatTile label="Placed" value={placed} hint="Committed" />
        <StatTile label="In production" value={inProduction} tone="default" />
        <StatTile label="Dispatched" value={dispatched} tone="good" />
      </StatGrid>

      <Section title="Recent orders">
        {recent.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No orders yet"
            description="Create your first order to get started."
            action={
              <ButtonLink href="/asm/orders/new">Create an order</ButtonLink>
            }
          />
        ) : (
          <div className="space-y-2.5">
            {recent.map((o) => (
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
      </Section>

      <Section title="SLA watch">
        <PhaseNote phase="Phase 3">
          Orders breaching the review SLA will surface here, with reminder and
          escalation status. Intervals are set by Admin.
        </PhaseNote>
      </Section>
    </>
  );
}
