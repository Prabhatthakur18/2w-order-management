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
 * Floating-island layout from the design system, scaled for mobile:
 * bottom nav on phones, sidebar island from md up.
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

  // overflow-x-hidden: glow blobs overhang the viewport by design and would
  // otherwise widen the document, forcing a horizontal scrollbar.
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-app-wrapper">
      {/* Glow blobs behind the UI */}
      <div
        className="glow-blob -top-32 -left-24 h-72 w-72 bg-primary/25"
        aria-hidden
      />
      <div
        className="glow-blob top-1/3 -right-24 h-72 w-72 bg-brand-orange/20"
        aria-hidden
      />

      <div className="relative z-10 md:flex md:gap-4 md:p-4">
        {/* Sidebar island — desktop */}
        <aside className="hidden md:sticky md:top-4 md:block md:h-[calc(100dvh-2rem)] md:w-72 md:shrink-0 lg:w-80">
          <div className="glass-card flex h-full flex-col rounded-[32px] p-4">
            <div className="px-2 pb-5 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {meta.label}
              </p>
              <h1 className="text-gradient-premium text-xl font-bold">
                2W Orders
              </h1>
            </div>

            <nav className="flex-1 space-y-1.5 overflow-y-auto">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex h-12 items-center gap-3 rounded-2xl border border-transparent px-3 text-sm font-medium text-foreground transition-all duration-300 hover:border-border hover:bg-card hover:shadow-float"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground transition-transform duration-300 group-hover:scale-110 group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-3 border-t border-border pt-3">
              <p className="truncate px-2 pb-2 text-xs text-muted-foreground">
                {userName}
              </p>
              <SignOutButton />
            </div>
          </div>
        </aside>

        {/* Main island */}
        <div className="min-w-0 flex-1">
          {/* Mobile header */}
          <header className="glass-card sticky top-0 z-20 flex h-16 items-center justify-between gap-3 rounded-b-3xl px-4 md:hidden">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {meta.label}
              </p>
              <h1 className="truncate text-base font-bold">2W Orders</h1>
            </div>
            <SignOutButton />
          </header>

          <main className="px-4 pb-28 pt-5 md:min-h-[calc(100dvh-2rem)] md:rounded-[32px] md:bg-card/60 md:px-6 md:pb-8 md:shadow-float md:backdrop-blur">
            {children}
          </main>
        </div>
      </div>

      {/* Bottom nav — mobile, thumb reachable */}
      <nav className="glass-card fixed inset-x-0 bottom-0 z-30 rounded-t-3xl pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {nav.slice(0, 5).map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className="flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground transition-all duration-300 active:scale-95 active:text-primary"
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
