import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/dashboard";
import { EmptyState } from "@/components/ui";
import { ClipboardCheck } from "lucide-react";
import {
  PendingDealerRow,
  PendingSubDealerRow,
  PendingEkycRow,
} from "./pending-rows";

export default async function MastersPage() {
  await requireRole(["ADMIN"]);

  const [pendingDealers, pendingSubDealers, pendingEkyc] = await Promise.all([
    db.dealer.findMany({
      where: { approvalStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { createdBy: { select: { name: true, email: true } } },
    }),
    db.subDealer.findMany({
      where: { approvalStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        dealer: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
    db.ekycProfile.findMany({
      where: { approvalStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        dealer: { select: { name: true } },
        subDealer: { select: { name: true } },
        documents: { include: { fileAsset: { select: { originalName: true } } } },
      },
    }),
  ]);

  const totalPending =
    pendingDealers.length + pendingSubDealers.length + pendingEkyc.length;

  return (
    <>
      <PageHeader
        title="Masters"
        subtitle={
          totalPending > 0
            ? `${totalPending} awaiting your approval`
            : "Nothing awaiting approval"
        }
      />

      <Section title="Pending dealers">
        {pendingDealers.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" />}
            title="No dealers pending"
            description="Dealers added by an ASM will appear here for review."
          />
        ) : (
          <div className="space-y-2.5">
            {pendingDealers.map((d) => (
              <PendingDealerRow
                key={d.id}
                dealer={{
                  id: d.id,
                  code: d.code,
                  name: d.name,
                  gstin: d.gstin,
                  gstLegalName: d.gstLegalName,
                  gstStatus: d.gstStatus,
                  address: d.address,
                  city: d.city,
                  state: d.state,
                  pincode: d.pincode,
                  contactName: d.contactName,
                  contactNo: d.contactNo,
                  email: d.email,
                  createdAt: d.createdAt.toISOString(),
                  createdByName: d.createdBy?.name ?? "Unknown",
                }}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Pending sub-dealers">
        {pendingSubDealers.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" />}
            title="No sub-dealers pending"
            description="Sub-dealers added by an ASM will appear here for review."
          />
        ) : (
          <div className="space-y-2.5">
            {pendingSubDealers.map((s) => (
              <PendingSubDealerRow
                key={s.id}
                subDealer={{
                  id: s.id,
                  name: s.name,
                  dealerName: s.dealer.name,
                  address: s.address,
                  city: s.city,
                  state: s.state,
                  pincode: s.pincode,
                  contactNo: s.contactNo,
                  email: s.email,
                  createdAt: s.createdAt.toISOString(),
                  createdByName: s.createdBy?.name ?? "Unknown",
                }}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Pending eKYC">
        {pendingEkyc.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" />}
            title="No eKYC pending"
            description="Documents uploaded by an ASM will appear here for review."
          />
        ) : (
          <div className="space-y-2.5">
            {pendingEkyc.map((e) => (
              <PendingEkycRow
                key={e.id}
                ekyc={{
                  id: e.id,
                  ownerName: e.dealer?.name ?? e.subDealer?.name ?? "Unknown",
                  ownerKind: e.dealer ? "Dealer" : "Sub-dealer",
                  mouNote: e.mouNote,
                  createdAt: e.createdAt.toISOString(),
                  documents: e.documents.map((d) => ({
                    id: d.id,
                    docType: d.docType,
                    fileAssetId: d.fileAssetId,
                    fileName: d.fileAsset.originalName,
                  })),
                }}
              />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
