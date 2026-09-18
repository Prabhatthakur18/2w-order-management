import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Mail, MapPin, Phone, UserPlus } from "lucide-react";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/dashboard";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { formatDate, formatINR } from "@/lib/utils";
import { EkycSection } from "./ekyc/ekyc-section";

const STATUS_TONE = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
} as const;

const EKYC_STATUS_LABEL = {
  APPROVED: "eKYC approved",
  PENDING: "eKYC pending review",
  REJECTED: "eKYC rejected",
} as const;

export default async function DealerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ASM", "ADMIN"]);
  const { id } = await params;

  const dealer = await db.dealer.findFirst({
    // An ASM can view any approved dealer, plus their own pending/rejected
    // submissions — same visibility rule as the dealers list.
    where: {
      id,
      isActive: true,
      OR: [{ approvalStatus: "APPROVED" }, { createdById: session.user.id }],
    },
    include: {
      subDealers: {
        orderBy: [{ approvalStatus: "asc" }, { name: "asc" }],
        include: {
          ekycProfile: { select: { approvalStatus: true } },
        },
      },
      ekycProfile: {
        include: { documents: { include: { fileAsset: { select: { originalName: true } } } } },
      },
      _count: { select: { orders: true } },
    },
  });

  if (!dealer) notFound();

  const isAdmin = session.user.roles.includes("ADMIN");

  return (
    <>
      <PageHeader
        title={dealer.name}
        subtitle={dealer.code}
        action={
          dealer.approvalStatus === "APPROVED"
            ? { href: `/asm/dealers/${dealer.id}/sub-dealers/new`, label: "Add sub-dealer" }
            : undefined
        }
      />

      <Card
        className="rail"
        style={
          {
            "--rail-color":
              dealer.approvalStatus === "APPROVED"
                ? "hsl(var(--success))"
                : dealer.approvalStatus === "PENDING"
                  ? "hsl(var(--warning))"
                  : "hsl(var(--destructive))",
          } as React.CSSProperties
        }
      >
        <div className="flex items-center justify-between gap-3">
          <Badge tone={STATUS_TONE[dealer.approvalStatus]}>
            {dealer.approvalStatus === "APPROVED"
              ? "Approved"
              : dealer.approvalStatus === "PENDING"
                ? "Pending approval"
                : "Rejected"}
          </Badge>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {dealer._count.orders} order{dealer._count.orders === 1 ? "" : "s"}
            </span>
            <ButtonLink href={`/asm/dealers/${dealer.id}/edit`} size="sm" variant="secondary">
              Edit
            </ButtonLink>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {dealer.address}, {dealer.city}, {dealer.state} —{" "}
              {dealer.pincode}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>
              {dealer.contactName ? `${dealer.contactName} — ` : ""}
              {dealer.contactNo}
            </span>
          </p>
          {dealer.email ? (
            <p className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span>{dealer.email}</span>
            </p>
          ) : null}
          {dealer.gstin ? (
            <p className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono">{dealer.gstin}</span>
            </p>
          ) : null}
        </div>

        {dealer.approvalStatus === "REJECTED" && dealer.rejectedReason ? (
          <p className="mt-3 rounded-xl bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
            {dealer.rejectedReason}
          </p>
        ) : null}

        {(dealer.creditLimit || dealer.creditDays) ? (
          <div className="mt-3 flex gap-4 border-t border-border pt-2.5 text-xs text-muted-foreground">
            {dealer.creditLimit ? (
              <span>
                Credit limit{" "}
                <strong className="font-semibold text-foreground">
                  {formatINR(dealer.creditLimit.toString())}
                </strong>
              </span>
            ) : null}
            {dealer.creditDays ? (
              <span>
                Terms{" "}
                <strong className="font-semibold text-foreground">
                  {dealer.creditDays} days
                </strong>
              </span>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Section title="eKYC">
        <EkycSection
          ownerType="DEALER"
          ownerId={dealer.id}
          dealerId={dealer.id}
          profile={dealer.ekycProfile}
          canReview={isAdmin}
        />
      </Section>

      <Section
        title={`Sub-dealers (${dealer.subDealers.length})`}
        action={
          dealer.approvalStatus === "APPROVED" ? (
            <ButtonLink
              href={`/asm/dealers/${dealer.id}/sub-dealers/new`}
              size="sm"
              variant="secondary"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add
            </ButtonLink>
          ) : undefined
        }
      >
        {dealer.subDealers.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-5 w-5" />}
            title="No sub-dealers yet"
            description={
              dealer.approvalStatus === "APPROVED"
                ? "Add the first sub-dealer under this dealer."
                : "Sub-dealers can be added once this dealer is approved."
            }
            action={
              dealer.approvalStatus === "APPROVED" ? (
                <ButtonLink href={`/asm/dealers/${dealer.id}/sub-dealers/new`}>
                  Add sub-dealer
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2.5">
            {dealer.subDealers.map((s) => (
              <Link
                key={s.id}
                href={`/asm/dealers/${dealer.id}/sub-dealers/${s.id}`}
                className="block"
              >
                <Card
                  className="rail transition-shadow hover:shadow-sm"
                  style={
                    {
                      "--rail-color":
                        s.approvalStatus === "APPROVED"
                          ? "hsl(var(--success))"
                          : s.approvalStatus === "PENDING"
                            ? "hsl(var(--warning))"
                            : "hsl(var(--destructive))",
                    } as React.CSSProperties
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">{s.name}</p>
                        {s.approvalStatus !== "APPROVED" ? (
                          <Badge tone={STATUS_TONE[s.approvalStatus]}>
                            {s.approvalStatus === "PENDING"
                              ? "Pending"
                              : "Rejected"}
                          </Badge>
                        ) : null}
                        {s.ekycProfile ? (
                          <Badge tone={STATUS_TONE[s.ekycProfile.approvalStatus]}>
                            {EKYC_STATUS_LABEL[s.ekycProfile.approvalStatus]}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">eKYC not started</Badge>
                        )}
                      </div>
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {s.address}
                          {s.city ? `, ${s.city}` : ""}
                          {s.pincode ? ` — ${s.pincode}` : ""}
                        </span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" />
                        {s.contactNo}
                      </p>
                      {s.gstin ? (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="font-mono">{s.gstin}</span>
                        </p>
                      ) : null}
                      {s.approvalStatus === "REJECTED" && s.rejectedReason ? (
                        <p className="mt-1 text-xs text-destructive">
                          {s.rejectedReason}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDate(s.createdAt)}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
