import Link from "next/link";
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
import { Badge, Card, EmptyState, ButtonLink } from "@/components/ui";
import { formatINR, formatDate } from "@/lib/utils";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/order-status";

export default async function AsmDashboard() {
  const session = await requireRole(["ASM", "ADMIN"]);
  const isAdmin = session.user.roles.includes("ADMIN");
  const scope = isAdmin ? {} : { createdById: session.user.id };

  const [draft, pending, inProduction, dispatched, recent] = await Promise.all([
    db.order.count({ where: { ...scope, status: "DRAFT" } }),
    db.order.count({ where: { ...scope, status: "PENDING_APPROVAL" } }),
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
        <StatTile label="Draft" value={draft} hint="Not yet submitted" />
        <StatTile
          label="Awaiting approval"
          value={pending}
          tone="warn"
          hint="With dealer"
        />
        <StatTile label="In production" value={inProduction} />
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
              <Link key={o.id} href={`/asm/orders/${o.id}`} className="block">
                <Card className="card-hover">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {o.orderNo}
                      </p>
                      <p className="truncate font-semibold">{o.dealer.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(o.createdAt)}
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
