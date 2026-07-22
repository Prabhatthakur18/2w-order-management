import { requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Icons } from "@/components/icons";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["ADMIN"]);

  return (
    <AppShell
      role="ADMIN"
      userName={session.user.name ?? ""}
      nav={[
        { href: "/admin", label: "Home", icon: Icons.home },
        { href: "/admin/masters", label: "Masters", icon: Icons.masters },
        { href: "/admin/pricing", label: "Pricing", icon: Icons.pricing },
        { href: "/admin/users", label: "Users", icon: Icons.users },
        { href: "/admin/config", label: "Rules", icon: Icons.settings },
      ]}
    >
      {children}
    </AppShell>
  );
}
