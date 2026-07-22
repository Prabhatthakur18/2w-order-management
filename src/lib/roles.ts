import type { Role } from "@prisma/client";

/**
 * Role definitions drive navigation, landing pages, and access checks.
 * Derived from the flowchart lanes — see TECH_STACK.md §2.
 */
export const ROLE_META: Record<
  Role,
  { label: string; home: string; description: string; colour: string }
> = {
  ADMIN: {
    label: "Admin",
    home: "/admin",
    description: "Masters, pricing, GST, users and business rules",
    colour: "slate",
  },
  ASM: {
    label: "ASM",
    home: "/asm",
    description: "Dealer orders, configuration and commercial terms",
    colour: "blue",
  },
  PLANT_OPS: {
    label: "Plant Ops",
    home: "/plant",
    description: "Stock, production and dispatch quantities",
    colour: "teal",
  },
  ACCOUNTS: {
    label: "Accounts",
    home: "/accounts",
    description: "Invoicing, cash discount and payment verification",
    colour: "purple",
  },
  DISPATCH: {
    label: "Dispatch",
    home: "/dispatch",
    description: "Packing, transporter and docket details",
    colour: "orange",
  },
  DEALER: {
    label: "Dealer",
    home: "/dealer",
    description: "Review and approve your orders",
    colour: "green",
  },
};

export const ALL_ROLES: Role[] = [
  "ADMIN",
  "ASM",
  "PLANT_OPS",
  "ACCOUNTS",
  "DISPATCH",
  "DEALER",
];

/** Route prefix → roles permitted. Enforced in middleware and per-page. */
export const ROUTE_ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/asm", roles: ["ASM", "ADMIN"] },
  { prefix: "/plant", roles: ["PLANT_OPS", "ADMIN"] },
  { prefix: "/accounts", roles: ["ACCOUNTS", "ADMIN"] },
  { prefix: "/dispatch", roles: ["DISPATCH", "ADMIN"] },
  { prefix: "/dealer", roles: ["DEALER", "ADMIN"] },
];

export function rolesForPath(pathname: string): Role[] | null {
  const match = ROUTE_ACCESS.find((r) => pathname.startsWith(r.prefix));
  return match ? match.roles : null;
}

export function canAccess(userRoles: Role[], pathname: string): boolean {
  const required = rolesForPath(pathname);
  if (!required) return true;
  return userRoles.some((r) => required.includes(r));
}

/** Where to send a user after login, based on their highest-priority role. */
export function landingFor(roles: Role[]): string {
  const priority: Role[] = [
    "ADMIN",
    "ASM",
    "PLANT_OPS",
    "ACCOUNTS",
    "DISPATCH",
    "DEALER",
  ];
  const primary = priority.find((p) => roles.includes(p));
  return primary ? ROLE_META[primary].home : "/";
}
