import { requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Icons } from "@/components/icons";

export default async function DealerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["DEALER", "ADMIN"]);

  return (
    <AppShell
      role="DEALER"
      userName={session.user.name ?? ""}
      nav={[
        { href: "/dealer", label: "Home", icon: Icons.home },
        { href: "/dealer/approvals", label: "Approvals", icon: Icons.check },
        { href: "/dealer/orders", label: "Orders", icon: Icons.orders },
      ]}
    >
      {children}
    </AppShell>
  );
}
