import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { landingFor } from "@/lib/roles";

/** Require a session. Redirects to login if absent. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/**
 * Require one of the given roles. This is the real authorization check —
 * call it in every protected page and server action.
 */
export async function requireRole(allowed: Role[]) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  const ok = roles.some((r) => allowed.includes(r));
  if (!ok) redirect(landingFor(roles));
  return session;
}
