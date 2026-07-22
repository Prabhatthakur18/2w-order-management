import {
  PageHeader,
  PhaseNote,
  Section,
  StatGrid,
  StatTile,
} from "@/components/dashboard";

export default function DealerDashboard() {
  return (
    <>
      <PageHeader
        title="Dealer dashboard"
        subtitle="Review and track your orders"
      />

      <StatGrid>
        <StatTile label="Awaiting your approval" value={0} tone="warn" />
        <StatTile label="In production" value={0} />
        <StatTile label="Dispatched" value={0} tone="good" />
        <StatTile label="Outstanding" value="₹0" hint="Credit orders" />
      </StatGrid>

      <Section title="Pending approvals">
        <PhaseNote phase="Phase 3">
          In-app order approval, replacing the emailed PDF. The report flags
          this gate as the workflow&apos;s highest-risk bottleneck.
        </PhaseNote>
      </Section>

      <Section title="Status">
        <PhaseNote phase="Not yet enabled">
          Dealer logins stay switched off until the business confirms dealers
          should approve in-app rather than by email.
        </PhaseNote>
      </Section>
    </>
  );
}
