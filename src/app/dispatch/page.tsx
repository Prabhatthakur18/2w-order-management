import {
  PageHeader,
  PhaseNote,
  Section,
  StatGrid,
  StatTile,
} from "@/components/dashboard";

export default function DispatchDashboard() {
  return (
    <>
      <PageHeader
        title="Dispatch dashboard"
        subtitle="Packing, transporter and docket details"
      />

      <StatGrid>
        <StatTile label="Ready to dispatch" value={0} tone="warn" />
        <StatTile label="Docket pending" value={0} />
        <StatTile label="In transit" value={0} />
        <StatTile label="Delivered" value={0} tone="good" hint="This month" />
      </StatGrid>

      <Section title="Dispatch queue">
        <PhaseNote phase="Phase 6">
          Box name, dispatch date, transporter (from master) and docket number.
          Confirming dispatch notifies the dealer and ASM automatically.
        </PhaseNote>
      </Section>
    </>
  );
}
