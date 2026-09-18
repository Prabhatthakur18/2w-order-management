import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard";
import { EditSubDealerForm } from "./edit-sub-dealer-form";

export default async function EditSubDealerPage({
  params,
}: {
  params: Promise<{ id: string; subDealerId: string }>;
}) {
  const session = await requireRole(["ASM", "ADMIN"]);
  const { id: dealerId, subDealerId } = await params;

  const subDealer = await db.subDealer.findFirst({
    where: {
      id: subDealerId,
      dealerId,
      isActive: true,
      OR: [{ approvalStatus: "APPROVED" }, { createdById: session.user.id }],
    },
  });

  if (!subDealer) notFound();

  return (
    <>
      <PageHeader title={`Edit ${subDealer.name}`} />
      <EditSubDealerForm
        dealerId={dealerId}
        subDealerId={subDealer.id}
        initial={{
          gstin: subDealer.gstin ?? "",
          name: subDealer.name,
          address: subDealer.address,
          city: subDealer.city ?? "",
          state: subDealer.state ?? "",
          pincode: subDealer.pincode ?? "",
          contactNo: subDealer.contactNo,
          email: subDealer.email ?? "",
          gstLegalName: subDealer.gstLegalName ?? "",
          gstTradeName: subDealer.gstTradeName ?? "",
          gstStatus: subDealer.gstStatus ?? "",
          gstRegisteredAt: subDealer.gstRegisteredAt
            ? subDealer.gstRegisteredAt.toISOString().slice(0, 10)
            : "",
        }}
      />
    </>
  );
}
