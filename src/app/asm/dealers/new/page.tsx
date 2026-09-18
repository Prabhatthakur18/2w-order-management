import { requireRole } from "@/lib/guard";
import { PageHeader } from "@/components/dashboard";
import { NewDealerForm } from "./new-dealer-form";

export default async function NewDealerPage() {
  await requireRole(["ASM", "ADMIN"]);

  return (
    <>
      <PageHeader
        title="Add dealer"
        subtitle="Goes to Admin for approval before it can be used on orders"
      />
      <NewDealerForm />
    </>
  );
}
