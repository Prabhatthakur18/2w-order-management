import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { renderProformaInvoice } from "@/lib/proforma";

/**
 * Generates the Proforma Invoice at request time from live order state.
 * Nothing is written to disk — only a DocumentIssueLog row recording that
 * it was generated, by whom and when (TECH_STACK.md §4A).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const roles = session.user.roles ?? [];
  const privileged =
    roles.includes("ADMIN") ||
    roles.includes("ACCOUNTS") ||
    roles.includes("DISPATCH");

  const order = await db.order.findFirst({
    // An ASM may only render their own orders; a dealer only theirs.
    where: privileged
      ? { id }
      : roles.includes("DEALER")
        ? { id, dealerId: session.user.dealerId ?? "__none__" }
        : { id, createdById: session.user.id },
    include: {
      dealer: true,
      subDealer: true,
      scheme: true,
      lines: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true } },
    },
  });

  if (!order) return new NextResponse("Not found", { status: 404 });

  // A PI belongs to a committed order; before that the figures can still change.
  if (!order.piNumber) {
    return new NextResponse(
      "The proforma invoice is available once the order is placed.",
      { status: 409 },
    );
  }

  await db.documentIssueLog.create({
    data: {
      orderId: order.id,
      docType: "PI",
      docNumber: order.piNumber,
      issuedById: session.user.id,
    },
  });

  return new NextResponse(renderProformaInvoice(order), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Always regenerated; a cached copy would show stale figures.
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
