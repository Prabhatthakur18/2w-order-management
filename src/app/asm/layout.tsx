import { requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Icons } from "@/components/icons";

export default async function AsmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["ASM", "ADMIN"]);

  return (
    <AppShell
      role="ASM"
      userName={session.user.name ?? ""}
      nav={[
        { href: "/asm", label: "Home", icon: Icons.home },
        { href: "/asm/orders", label: "Orders", icon: Icons.orders },
        { href: "/asm/orders/new", label: "New", icon: Icons.plus },
        { href: "/asm/dealers", label: "Dealers", icon: Icons.users },
      ]}
    >
      {children}
    </AppShell>
  );
}
