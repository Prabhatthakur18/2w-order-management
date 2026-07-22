import Link from "next/link";
import type { Role } from "@prisma/client";
import { ROLE_META } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

/**
 * Mobile-first shell: bottom nav on phones, sidebar from md up.
 * TECH_STACK.md §5 rules 1–3.
 */
export function AppShell({
  role,
  userName,
  nav,
  children,
}: {
  role: Role;
  userName: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const meta = ROLE_META[role];

  return (
    <div className="min-h-dvh">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              {meta.label}
            </p>
            <h1 className="truncate text-base font-semibold">2W Orders</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-[var(--muted)] sm:inline">
              {userName}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        {/* Sidebar — desktop only */}
        <aside className="hidden w-56 shrink-0 border-r border-[var(--border)] p-3 md:block">
          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg)]"
              >
                <span className="text-[var(--muted)]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Content — bottom padding clears the mobile nav */}
        <main className="min-w-0 flex-1 px-4 pb-28 pt-4 md:pb-8">{children}</main>
      </div>

      {/* Bottom nav — mobile only, thumb reachable */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {nav.slice(0, 5).map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className="flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium text-[var(--muted)] transition-colors active:bg-[var(--bg)]"
              >
                <span aria-hidden>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
