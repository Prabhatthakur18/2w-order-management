import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Mail, MapPin, Phone } from "lucide-react";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/dashboard";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { EkycSection } from "../../ekyc/ekyc-section";

const STATUS_TONE = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
} as const;

export default async function SubDealerDetailPage({
  params,
}: {
  params: Promise<{ id: string; subDealerId: string }>;
}) {
  const session = await requireRole(["ASM", "ADMIN"]);
  const { id: dealerId, subDealerId } = await params;

  const subDealer = await db.subDealer.findFirst({
    // A mismatched dealer/sub-dealer pair in the URL 404s instead of
    // silently rendering the wrong context.
    where: {
      id: subDealerId,
      dealerId,
      isActive: true,
      OR: [{ approvalStatus: "APPROVED" }, { createdById: session.user.id }],
    },
    include: {
      dealer: { select: { id: true, name: true, code: true } },
      ekycProfile: {
        include: { documents: { include: { fileAsset: { select: { originalName: true } } } } },
      },
    },
  });

  if (!subDealer) notFound();

  const isAdmin = session.user.roles.includes("ADMIN");

  return (
    <>
      <Link
        href={`/asm/dealers/${dealerId}`}
        className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {subDealer.dealer.name}
      </Link>

      <PageHeader
        title={subDealer.name}
        subtitle={`Under ${subDealer.dealer.name}`}
      />

      <Card
        className="rail"
        style={
          {
            "--rail-color":
              subDealer.approvalStatus === "APPROVED"
                ? "hsl(var(--success))"
                : subDealer.approvalStatus === "PENDING"
                  ? "hsl(var(--warning))"
                  : "hsl(var(--destructive))",
          } as React.CSSProperties
        }
      >
        <div className="flex items-center justify-between gap-3">
          <Badge tone={STATUS_TONE[subDealer.approvalStatus]}>
            {subDealer.approvalStatus === "APPROVED"
              ? "Approved"
              : subDealer.approvalStatus === "PENDING"
                ? "Pending approval"
                : "Rejected"}
          </Badge>
          <ButtonLink
            href={`/asm/dealers/${dealerId}/sub-dealers/${subDealerId}/edit`}
            size="sm"
            variant="secondary"
          >
            Edit
          </ButtonLink>
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {subDealer.address}
              {subDealer.city ? `, ${subDealer.city}` : ""}
              {subDealer.state ? `, ${subDealer.state}` : ""}
              {subDealer.pincode ? ` — ${subDealer.pincode}` : ""}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{subDealer.contactNo}</span>
          </p>
          {subDealer.email ? (
            <p className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span>{subDealer.email}</span>
            </p>
          ) : null}
          {subDealer.gstin ? (
            <p className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono">{subDealer.gstin}</span>
            </p>
          ) : null}
        </div>

        {subDealer.approvalStatus === "REJECTED" && subDealer.rejectedReason ? (
          <p className="mt-3 rounded-xl bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
            {subDealer.rejectedReason}
          </p>
        ) : null}
      </Card>

      <Section title="eKYC">
        <EkycSection
          ownerType="SUBDEALER"
          ownerId={subDealer.id}
          dealerId={subDealer.dealer.id}
          profile={subDealer.ekycProfile}
          canReview={isAdmin}
        />
      </Section>
    </>
  );
}
