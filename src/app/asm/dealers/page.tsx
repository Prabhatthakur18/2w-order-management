import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { formatINR } from "@/lib/utils";

const STATUS_TONE = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
} as const;

export default async function DealersPage() {
  const session = await requireRole(["ASM", "ADMIN"]);

  // An ASM sees their own submissions plus every approved dealer; Admin sees
  // everything via the separate /admin/masters queue, so this stays scoped.
  const dealers = await db.dealer.findMany({
    where: {
      isActive: true,
      OR: [{ approvalStatus: "APPROVED" }, { createdById: session.user.id }],
    },
    orderBy: [{ approvalStatus: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { subDealers: true, orders: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Dealers"
        subtitle={`${dealers.length} dealer${dealers.length === 1 ? "" : "s"}`}
        action={{ href: "/asm/dealers/new", label: "Add dealer" }}
      />

      {dealers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No dealers yet"
          description="Add a dealer to get started — it goes to Admin for approval."
          action={<ButtonLink href="/asm/dealers/new">Add dealer</ButtonLink>}
        />
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {dealers.map((d) => (
            <Link key={d.id} href={`/asm/dealers/${d.id}`} className="block">
              <Card className="card-hover">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 font-display text-sm font-bold text-primary"
                    aria-hidden
                  >
                    {d.name.slice(0, 2).toUpperCase()}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold leading-snug">
                        {d.name}
                      </p>
                      {d.approvalStatus !== "APPROVED" ? (
                        <Badge tone={STATUS_TONE[d.approvalStatus]}>
                          {d.approvalStatus === "PENDING"
                            ? "Pending approval"
                            : "Rejected"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {d.code}
                    </p>
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {d.city}, {d.state} — {d.pincode}
                      </span>
                    </p>
                    {d.approvalStatus === "REJECTED" && d.rejectedReason ? (
                      <p className="mt-1 text-xs text-destructive">
                        {d.rejectedReason}
                      </p>
                    ) : null}
                  </div>

                  {d.creditLimit ? (
                    <div className="shrink-0 text-right">
                      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                        Credit
                      </p>
                      <p className="font-display text-sm font-semibold tabular-nums">
                        {formatINR(d.creditLimit.toString())}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-4 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">
                    <strong className="font-semibold text-foreground">
                      {d._count.orders}
                    </strong>{" "}
                    orders
                  </span>
                  <span className="tabular-nums">
                    <strong className="font-semibold text-foreground">
                      {d._count.subDealers}
                    </strong>{" "}
                    sub-dealers
                  </span>
                  {d.creditDays ? (
                    <span className="tabular-nums">
                      <strong className="font-semibold text-foreground">
                        {d.creditDays}
                      </strong>{" "}
                      days
                    </span>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
