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
        <div className="space-y-2.5">
          {dealers.map((d) => (
            <Card key={d.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{d.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {d.code}
                  </p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      {d.city}, {d.state} — {d.pincode}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p>{d._count.orders} orders</p>
                  <p>{d._count.subDealers} sub-dealers</p>
                  {d.creditLimit ? (
                    <p className="mt-1 font-semibold text-foreground">
                      {formatINR(d.creditLimit.toString())}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
