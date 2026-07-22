import {
  PageHeader,
  PhaseNote,
  Section,
  StatGrid,
  StatTile,
} from "@/components/dashboard";

export default function AdminDashboard() {
  return (
    <>
      <PageHeader
        title="Admin dashboard"
        subtitle="Masters, pricing and business rules"
      />

      <StatGrid>
        <StatTile label="Active dealers" value={0} />
        <StatTile label="Parts in catalog" value={0} />
        <StatTile label="Open orders" value={0} />
        <StatTile label="Users" value={0} />
      </StatGrid>

      <Section title="Master data">
        <PhaseNote phase="Phase 1">
          Dealers, sub-dealers, the OEM → Vehicle → Part → Colour catalog,
          transporters and schemes.
        </PhaseNote>
      </Section>

      <Section title="Pricing &amp; tax">
        <PhaseNote phase="Phase 1B">
          Date-effective price lists, per-item GST slabs, discount caps and
          stacking rules. Orders cannot compute values until these exist.
        </PhaseNote>
      </Section>

      <Section title="Business rules">
        <PhaseNote phase="Phase 1B">
          Cash-discount eligibility by payment mode, review SLA intervals,
          payment sequencing and document numbering. Every change is audited.
        </PhaseNote>
      </Section>
    </>
  );
}
