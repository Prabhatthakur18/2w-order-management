import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard";
import { NewSubDealerForm } from "./new-sub-dealer-form";

export default async function NewSubDealerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ASM", "ADMIN"]);
  const { id } = await params;

  const dealer = await db.dealer.findFirst({
    where: { id },
    select: { id: true, name: true, code: true },
  });
  if (!dealer) notFound();

  return (
    <>
      <PageHeader
        title="Add sub-dealer"
        subtitle={`Under ${dealer.name} — goes to Admin for approval`}
      />
      <NewSubDealerForm dealerId={dealer.id} />
    </>
  );
}
