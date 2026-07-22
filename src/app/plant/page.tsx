import {
  PageHeader,
  PhaseNote,
  Section,
  StatGrid,
  StatTile,
} from "@/components/dashboard";

export default function PlantDashboard() {
  return (
    <>
      <PageHeader
        title="Plant Ops dashboard"
        subtitle="Stock, production and dispatch quantities"
      />

      <StatGrid>
        <StatTile label="Incoming" value={0} hint="Newly approved" />
        <StatTile label="In process" value={0} />
        <StatTile label="On hold" value={0} tone="warn" />
        <StatTile label="Dispatch ready" value={0} tone="good" />
      </StatGrid>

      <Section title="Production queue">
        <PhaseNote phase="Phase 4">
          Approved orders arrive here. Quantities move through
          Reserved → In Production → On Hold → Confirmed, with row-level locking
          so concurrent orders cannot double-count stock.
        </PhaseNote>
      </Section>
    </>
  );
}
