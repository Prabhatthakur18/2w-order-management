import { requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Icons } from "@/components/icons";

export default async function AccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["ACCOUNTS", "ADMIN"]);

  return (
    <AppShell
      role="ACCOUNTS"
      userName={session.user.name ?? ""}
      nav={[
        { href: "/accounts", label: "Home", icon: Icons.home },
        { href: "/accounts/invoices", label: "Invoices", icon: Icons.invoice },
        { href: "/accounts/payments", label: "Payments", icon: Icons.pricing },
      ]}
    >
      {children}
    </AppShell>
  );
}
