"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** True for an exact match, or for a section when the href is a prefix. */
function useActive(href: string) {
  const pathname = usePathname();
  const segments = href.split("/").filter(Boolean);
  // Role roots (/asm) should only light up on an exact match, otherwise
  // every child route would mark Home as active too.
  if (segments.length <= 1) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const active = useActive(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200",
        active
          ? "bg-primary/8 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {/* Indicator bar — position carries the state, not just colour. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-all duration-300",
          active ? "h-6 opacity-100" : "h-0 opacity-0",
        )}
      />
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted text-muted-foreground group-hover:scale-105 group-hover:text-foreground",
        )}
      >
        {icon}
      </span>
      {label}
    </Link>
  );
}

export function BottomNavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const active = useActive(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-2 transition-transform duration-200 active:scale-90"
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0 h-[3px] rounded-b-full bg-primary transition-all duration-300",
          active ? "w-8 opacity-100" : "w-0 opacity-0",
        )}
      />
      <span
        className={cn(
          "transition-colors duration-200",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "truncate text-[10px] font-bold uppercase tracking-[0.06em] transition-colors duration-200",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
