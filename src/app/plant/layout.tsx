import { requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Icons } from "@/components/icons";

export default async function PlantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["PLANT_OPS", "ADMIN"]);

  return (
    <AppShell
      role="PLANT_OPS"
      userName={session.user.name ?? ""}
      nav={[
        { href: "/plant", label: "Home", icon: Icons.home },
        { href: "/plant/queue", label: "Queue", icon: Icons.orders },
        { href: "/plant/stock", label: "Stock", icon: Icons.stock },
      ]}
    >
      {children}
    </AppShell>
  );
}
