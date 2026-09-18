import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard";
import {
  getActiveSchemes,
  getDealers,
  getDiscountRule,
  getOems,
} from "@/lib/catalog";
import { isEditable, sweepExpiredOrders } from "@/lib/order-lifecycle";
import type { OrderDraft } from "@/lib/order-draft";
import { EditOrderWizard } from "./edit-wizard";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ASM", "ADMIN"]);
  const { id } = await params;

  await sweepExpiredOrders();

  const isAdmin = session.user.roles.includes("ADMIN");
  const order = await db.order.findFirst({
    where: isAdmin ? { id } : { id, createdById: session.user.id },
    include: {
      lines: {
        orderBy: { createdAt: "asc" },
        include: {
          partColour: {
            include: {
              part: { include: { vehicle: { include: { oem: true } } } },
            },
          },
        },
      },
    },
  });

  if (!order) notFound();

  // The window may have closed between the link being rendered and followed.
  if (!isEditable(order)) redirect(`/asm/orders/${id}`);

  const [dealers, oems, schemes, rule] = await Promise.all([
    getDealers(),
    getOems(),
    getActiveSchemes(),
    getDiscountRule(),
  ]);

  const draft: OrderDraft = {
    dealerId: order.dealerId,
    subDealerId: order.subDealerId ?? "",
    newSubDealer: null,
    printingFrameId: order.printingFrameId ?? "",
    shippingSameAsDealer: order.shippingSameAsDealer,
    shippingAddress: order.shippingAddress ?? "",
    shippingCity: order.shippingCity ?? "",
    shippingState: order.shippingState ?? "",
    shippingPincode: order.shippingPincode ?? "",
    lines: order.lines.map((l) => ({
      key: l.id,
      oemId: l.partColour.part.vehicle.oem.id,
      oemName: l.partColour.part.vehicle.oem.name,
      vehicleId: l.partColour.part.vehicle.id,
      vehicleName: l.partColour.part.vehicle.name,
      partId: l.partColour.part.id,
      partNo: l.partColour.part.partNo,
      partName: l.partColour.part.name,
      partColourId: l.partColourId,
      colour: l.partColour.colour,
      productCode: l.productCode,
      packingUnit: l.packingUnit,
      qty: l.qty,
      unitPrice: l.unitPrice.toString(),
      gstRatePct: l.gstRatePct.toString(),
      remarks: l.remarks ?? "",
    })),
    dealerDiscountPct: order.dealerDiscountPct?.toString() ?? "0",
    schemeId: order.schemeId ?? "",
    remarks: order.remarks ?? "",
    paymentMode: order.paymentMode,
    creditDays: order.creditDays?.toString() ?? "",
    preferredTransporterId: order.preferredTransporterId ?? "",
    updatedAt: order.updatedAt.toISOString(),
  };

  return (
    <>
      <PageHeader
        title="Edit order"
        subtitle={order.orderNo}
      />
      <EditOrderWizard
        orderId={order.id}
        initialDraft={draft}
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
        config={{
          minDealerPct: rule?.minDealerPct.toString() ?? "45",
          maxDealerPct: rule?.maxDealerPct.toString() ?? "59",
        }}
      />
    </>
  );
}
