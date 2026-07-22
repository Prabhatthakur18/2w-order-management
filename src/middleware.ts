import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccess, landingFor } from "@/lib/roles";

/**
 * Coarse gate only. Every route handler and server action re-checks
 * authorization server-side — middleware is not the security boundary.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/";

  if (isPublic) return NextResponse.next();

  if (!session?.user) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const roles = session.user.roles ?? [];

  if (!canAccess(roles, pathname)) {
    return NextResponse.redirect(new URL(landingFor(roles), req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
