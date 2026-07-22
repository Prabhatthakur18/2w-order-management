import {
  PageHeader,
  PhaseNote,
  Section,
  StatGrid,
  StatTile,
} from "@/components/dashboard";

export default function AsmDashboard() {
  return (
    <>
      <PageHeader
        title="ASM dashboard"
        subtitle="Your orders, approvals and dealers"
        action={{ href: "/asm/orders/new", label: "New order" }}
      />

      <StatGrid>
        <StatTile label="Draft" value={0} hint="Not yet submitted" />
        <StatTile label="Awaiting approval" value={0} tone="warn" hint="With dealer" />
        <StatTile label="In production" value={0} />
        <StatTile label="Dispatched" value={0} tone="good" hint="This month" />
      </StatGrid>

      <Section title="SLA watch">
        <PhaseNote phase="Phase 3">
          Orders breaching the review SLA will surface here, with reminder and
          escalation status. Intervals are set by Admin.
        </PhaseNote>
      </Section>

      <Section title="Recent orders">
        <PhaseNote phase="Phase 2">
          Order capture — dealer and sub-dealer selection, the
          OEM → Vehicle → Part → Colour cascade, quantities and live pricing.
        </PhaseNote>
      </Section>
    </>
  );
}
