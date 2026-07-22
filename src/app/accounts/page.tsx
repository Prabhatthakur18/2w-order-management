import {
  PageHeader,
  PhaseNote,
  Section,
  StatGrid,
  StatTile,
} from "@/components/dashboard";

export default function AccountsDashboard() {
  return (
    <>
      <PageHeader
        title="Accounts dashboard"
        subtitle="Invoicing, cash discount and payment verification"
      />

      <StatGrid>
        <StatTile label="Awaiting dummy" value={0} />
        <StatTile label="Awaiting final" value={0} tone="warn" />
        <StatTile label="Receipts to verify" value={0} tone="warn" />
        <StatTile label="Invoiced" value={0} tone="good" hint="This month" />
      </StatGrid>

      <Section title="Invoice queue">
        <PhaseNote phase="Phase 5">
          Dummy and final invoice upload, with cash discount applied per the
          Admin-configured payment mode.
        </PhaseNote>
      </Section>

      <Section title="Credit vs advance">
        <PhaseNote phase="Phase 5">
          Split of open value by payment mode, with credit exposure per dealer
          against their limit.
        </PhaseNote>
      </Section>
    </>
  );
}
