import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard";
import { EditDealerForm } from "./edit-dealer-form";

export default async function EditDealerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ASM", "ADMIN"]);
  const { id } = await params;

  const dealer = await db.dealer.findFirst({
    where: {
      id,
      isActive: true,
      OR: [{ approvalStatus: "APPROVED" }, { createdById: session.user.id }],
    },
  });

  if (!dealer) notFound();

  return (
    <>
      <PageHeader title={`Edit ${dealer.name}`} subtitle={dealer.code} />
      <EditDealerForm
        dealerId={dealer.id}
        initial={{
          gstin: dealer.gstin ?? "",
          name: dealer.name,
          address: dealer.address,
          city: dealer.city,
          state: dealer.state,
          pincode: dealer.pincode,
          contactName: dealer.contactName ?? "",
          contactNo: dealer.contactNo ?? "",
          email: dealer.email ?? "",
          gstLegalName: dealer.gstLegalName ?? "",
          gstTradeName: dealer.gstTradeName ?? "",
          gstStatus: dealer.gstStatus ?? "",
          gstRegisteredAt: dealer.gstRegisteredAt
            ? dealer.gstRegisteredAt.toISOString().slice(0, 10)
            : "",
        }}
      />
    </>
  );
}
