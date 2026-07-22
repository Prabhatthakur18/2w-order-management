import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * VPS filesystem storage — TECH_STACK.md §4A.
 *
 * Files live OUTSIDE the web root. Nothing here is publicly reachable; every
 * read goes through an authenticated route handler that checks RBAC.
 *
 * All access is funnelled through this single interface so swapping to
 * S3-compatible storage later is one adapter, not a refactor.
 */

const UPLOAD_ROOT = process.env.UPLOAD_ROOT ?? "./.uploads";
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 8);
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_DOC_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
] as const;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export type StoredFile = {
  /** Path relative to the upload root. Never an absolute path. */
  path: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
};

/** Absolute path for a stored file, guarded against traversal. */
function resolveSafe(relativePath: string): string {
  const root = path.resolve(UPLOAD_ROOT);
  const full = path.resolve(root, relativePath);
  // A crafted "../.." must never escape the upload root.
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Invalid storage path");
  }
  return full;
}

/**
 * Writes a file under {entity}/{yyyy}/{mm}/{uuid}.{ext} — dated folders keep
 * directories small as volume grows.
 */
export async function storeFile(
  file: File,
  entity: string,
  allowedTypes: readonly string[] = ALLOWED_DOC_TYPES,
): Promise<StoredFile> {
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
  }
  if (file.size <= 0) {
    throw new Error("The file is empty.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds the ${MAX_UPLOAD_MB}MB limit.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Trust the bytes, not the declared type. Unrecognised content is rejected
  // outright — an unknown signature must never pass as an allowed type.
  const sniffed = sniffMime(buffer);
  if (!sniffed) {
    throw new Error("Unrecognised file content.");
  }
  if (sniffed !== file.type || !allowedTypes.includes(sniffed)) {
    throw new Error("File content does not match its declared type.");
  }

  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const ext = EXT_BY_MIME[file.type] ?? "bin";
  const relDir = path.join(sanitiseSegment(entity), yyyy, mm);
  const relPath = path.join(relDir, `${randomUUID()}.${ext}`);

  const absDir = resolveSafe(relDir);
  await mkdir(absDir, { recursive: true });
  await writeFile(resolveSafe(relPath), buffer);

  return {
    path: relPath.split(path.sep).join("/"),
    originalName: file.name.slice(0, 200),
    mimeType: file.type,
    sizeBytes: buffer.byteLength,
    checksum: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  return readFile(resolveSafe(relativePath));
}

export async function deleteStoredFile(relativePath: string): Promise<void> {
  try {
    await unlink(resolveSafe(relativePath));
  } catch {
    // Already gone — deleting is idempotent.
  }
}

function sanitiseSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "misc";
}

/** Magic-number check so a renamed executable cannot pose as an image. */
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return "image/png";
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (buf.toString("ascii", 0, 4) === "%PDF") return "application/pdf";
  return null;
}
