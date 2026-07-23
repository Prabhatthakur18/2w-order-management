import type { Role } from "@prisma/client";
import { ROLE_META } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { SidebarLink, BottomNavLink } from "@/components/nav-link";

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
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // overflow-x-hidden: glow blobs overhang the viewport by design and would
  // otherwise widen the document, forcing a horizontal scrollbar.
  return (
    <div className="bg-grid relative min-h-dvh overflow-x-hidden bg-app-wrapper">
      <div
        className="glow-blob -top-32 -left-24 h-72 w-72 bg-primary/20"
        aria-hidden
      />
      <div
        className="glow-blob top-1/3 -right-24 h-72 w-72 bg-brand-orange/15"
        aria-hidden
      />

      <div className="relative z-10 md:flex md:gap-5 md:p-5">
        {/* Sidebar island — desktop */}
        <aside className="hidden md:sticky md:top-5 md:block md:h-[calc(100dvh-2.5rem)] md:w-64 md:shrink-0 lg:w-72">
          <div className="glass-card flex h-full flex-col rounded-3xl p-3.5">
            <div className="flex items-center gap-3 px-2 pb-6 pt-2">
              <span
                className="gradient-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-primary-foreground shadow-glow"
                aria-hidden
              >
                2W
              </span>
              <div className="min-w-0">
                <h1 className="font-display truncate text-[15px] font-semibold leading-tight">
                  Orders
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-primary">
                  {meta.label}
                </p>
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto">
              {nav.map((item) => (
                <SidebarLink key={item.href} {...item} />
              ))}
            </nav>

            <div className="mt-3 flex items-center gap-2.5 border-t border-border pt-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground"
                aria-hidden
              >
                {initials}
              </span>
              <p className="min-w-0 flex-1 truncate text-xs font-medium">
                {userName}
              </p>
              <SignOutButton />
            </div>
          </div>
        </aside>

        {/*
          On desktop this column is capped to the viewport, same as the
          sidebar, and only its own content scrolls — a tall form (the order
          wizard) must never stretch the page past the sidebar's height.
        */}
        <div className="flex min-w-0 flex-1 flex-col md:h-[calc(100dvh-2.5rem)]">
          {/* Mobile header */}
          <header className="glass-card sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 rounded-b-2xl px-4 md:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="gradient-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-primary-foreground"
                aria-hidden
              >
                2W
              </span>
              <div className="min-w-0">
                <h1 className="font-display truncate text-sm font-semibold leading-tight">
                  Orders
                </h1>
                <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-primary">
                  {meta.label}
                </p>
              </div>
            </div>
            <SignOutButton />
          </header>

          <main className="animate-rise min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-6 md:rounded-3xl md:border md:border-border/60 md:bg-card/50 md:px-7 md:py-7 md:pb-7 md:shadow-sm md:backdrop-blur-sm">
            {children}
          </main>
        </div>
      </div>

      {/* Bottom nav — mobile, thumb reachable */}
      <nav className="glass-card fixed inset-x-0 bottom-0 z-30 rounded-t-2xl pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {nav.slice(0, 5).map((item) => (
            <li key={item.href} className="flex-1">
              <BottomNavLink {...item} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
