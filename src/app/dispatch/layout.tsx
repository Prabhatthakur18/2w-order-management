import { requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Icons } from "@/components/icons";

export default async function DispatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["DISPATCH", "ADMIN"]);

  return (
    <AppShell
      role="DISPATCH"
      userName={session.user.name ?? ""}
      nav={[
        { href: "/dispatch", label: "Home", icon: Icons.home },
        { href: "/dispatch/queue", label: "Queue", icon: Icons.orders },
        { href: "/dispatch/shipments", label: "Shipments", icon: Icons.truck },
      ]}
    >
      {children}
    </AppShell>
  );
}
