import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { renderOrderPdf } from "@/lib/order-pdf";

/**
 * Generates the plain order record ("Order Download in PDF File" in the
 * flowchart) at request time. Available at any status — unlike the PI, this
 * is a record of the order, not a commercial document tied to placement.
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

  await db.documentIssueLog.create({
    data: {
      orderId: order.id,
      docType: "ORDER_PDF",
      docNumber: order.orderNo,
      issuedById: session.user.id,
    },
  });

  return new NextResponse(renderOrderPdf(order), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
