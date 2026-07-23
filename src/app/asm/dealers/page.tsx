import { MapPin, Users } from "lucide-react";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard";
import { Card, EmptyState } from "@/components/ui";
import { formatINR } from "@/lib/utils";

export default async function DealersPage() {
  await requireRole(["ASM", "ADMIN"]);

  const dealers = await db.dealer.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { subDealers: true, orders: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Dealers"
        subtitle={`${dealers.length} active dealer${dealers.length === 1 ? "" : "s"}`}
      />

      {dealers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No dealers yet"
          description="Admin adds dealers to the master before orders can be placed."
        />
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {dealers.map((d) => (
            <Card key={d.id} className="card-hover">
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 font-display text-sm font-bold text-primary"
                  aria-hidden
                >
                  {d.name.slice(0, 2).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold leading-snug">
                    {d.name}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {d.code}
                  </p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {d.city}, {d.state} — {d.pincode}
                    </span>
                  </p>
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

              <div className="mt-3 flex gap-4 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
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
          ))}
        </div>
      )}
    </>
  );
}
