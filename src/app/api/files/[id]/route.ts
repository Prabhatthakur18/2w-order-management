import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

/**
 * Serves an uploaded file. Uploads live outside the web root, so this handler
 * is the only path to them — and it authenticates every request.
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

  const asset = await db.fileAsset.findUnique({
    where: { id },
    include: {
      printingFrames: { select: { dealerId: true } },
    },
  });

  if (!asset) {
    return new NextResponse("Not found", { status: 404 });
  }

  const roles = session.user.roles ?? [];

  // A DEALER may only read files belonging to their own dealer.
  if (roles.includes("DEALER") && roles.length === 1) {
    const dealerId = session.user.dealerId;
    const ownedByDealer = asset.printingFrames.some(
      (f) => f.dealerId === dealerId,
    );
    if (!dealerId || !ownedByDealer) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  try {
    const buffer = await readStoredFile(asset.path);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.sizeBytes),
        "Content-Disposition": `inline; filename="${encodeURIComponent(asset.originalName)}"`,
        // Private: this is per-user authorised content, never shared caches.
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    // Row exists but the bytes are gone — a real inconsistency worth surfacing.
    return new NextResponse("File unavailable", { status: 410 });
  }
}
