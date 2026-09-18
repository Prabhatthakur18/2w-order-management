import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/catalog";
import {
  renderProformaInvoice,
  DEFAULT_PI_COMPANY,
  type PiCompany,
} from "@/lib/proforma";

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
      printingFrame: true,
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

  // Seller details are Admin-editable in SystemConfig; fall back to the
  // built-in defaults if a row is missing.
  const cfg = await getConfig([
    "company.name",
    "company.address_line1",
    "company.address_line2",
    "company.gstin",
    "company.state_name",
    "company.email",
    "company.pan",
  ]);
  const company: PiCompany = {
    name: cfg["company.name"] || DEFAULT_PI_COMPANY.name,
    addressLine1: cfg["company.address_line1"] || DEFAULT_PI_COMPANY.addressLine1,
    addressLine2: cfg["company.address_line2"] || DEFAULT_PI_COMPANY.addressLine2,
    gstin: cfg["company.gstin"] || DEFAULT_PI_COMPANY.gstin,
    stateName: cfg["company.state_name"] || DEFAULT_PI_COMPANY.stateName,
    email: cfg["company.email"] || DEFAULT_PI_COMPANY.email,
    pan: cfg["company.pan"] || DEFAULT_PI_COMPANY.pan,
  };

  return new NextResponse(renderProformaInvoice(order, company), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Always regenerated; a cached copy would show stale figures.
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
