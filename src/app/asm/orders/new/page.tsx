import { requireRole } from "@/lib/guard";
import {
  getDealers,
  getOems,
  getActiveSchemes,
  getDiscountRule,
  getTransporters,
} from "@/lib/catalog";
import { PageHeader } from "@/components/dashboard";
import { EmptyState, ButtonLink } from "@/components/ui";
import { Boxes } from "lucide-react";
import { OrderWizard } from "./wizard";

export default async function NewOrderPage() {
  await requireRole(["ASM", "ADMIN"]);

  const [dealers, oems, schemes, transporters, rule] = await Promise.all([
    getDealers(),
    getOems(),
    getActiveSchemes(),
    getTransporters(),
    getDiscountRule(),
  ]);

  // Master data must exist before an order can reference it.
  if (dealers.length === 0 || oems.length === 0) {
    return (
      <>
        <PageHeader title="New order" />
        <EmptyState
          icon={<Boxes className="h-5 w-5" />}
          title="Master data required"
          description={
            dealers.length === 0 && oems.length === 0
              ? "No dealers or catalog items exist yet. Admin needs to add them before orders can be created."
              : dealers.length === 0
                ? "No active dealers exist yet."
                : "The product catalog is empty."
          }
          action={<ButtonLink href="/asm">Back to dashboard</ButtonLink>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="New order" subtitle="Draft is saved as you go" />
      <OrderWizard
        dealers={dealers.map((d) => ({
          ...d,
          creditLimit: d.creditLimit?.toString() ?? null,
        }))}
        oems={oems}
        schemes={schemes.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          discountPct: s.discountPct?.toString() ?? null,
          flatAmount: s.flatAmount?.toString() ?? null,
        }))}
        transporters={transporters}
        config={{
          minDealerPct: rule?.minDealerPct.toString() ?? "45",
          maxDealerPct: rule?.maxDealerPct.toString() ?? "59",
        }}
      />
    </>
  );
}
