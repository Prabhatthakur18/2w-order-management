"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2, TriangleAlert, X } from "lucide-react";
import { Button, Input } from "@/components/ui";

/**
 * Image picker with camera capture and client-side downscaling.
 *
 * Compressing before upload matters on a field connection — a phone photo is
 * often 4-8MB, and downscaling to 1600px typically cuts that by an order of
 * magnitude without losing artwork detail.
 */
export function ImageUpload({
  label,
  onUpload,
  busy,
  error,
}: {
  label: string;
  onUpload: (file: File, label: string) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!picked) return;

    setLocalError(null);
    setProcessing(true);
    try {
      const compressed = await compressImage(picked);
      setFile(compressed);
      setPreview(URL.createObjectURL(compressed));
      if (!name) setName(picked.name.replace(/\.[^.]+$/, "").slice(0, 60));
    } catch {
      setLocalError("Could not read that image. Try another file.");
    } finally {
      setProcessing(false);
    }
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setLocalError(null);
  }

  const shown = localError ?? error;

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePick}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePick}
      />

      {!preview ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="secondary"
            onClick={() => cameraRef.current?.click()}
            disabled={processing || busy}
          >
            <Camera className="h-4 w-4" />
            Camera
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={processing || busy}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageUp className="h-4 w-4" />
            )}
            Choose file
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
            {/* Local blob preview — next/image adds no value for object URLs */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Artwork preview"
              className="max-h-56 w-full object-contain"
            />
            <button
              type="button"
              onClick={clear}
              aria-label="Remove image"
              disabled={busy}
              className="absolute right-2 top-2 flex h-8 min-h-0 w-8 items-center justify-center rounded-lg bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Input
            placeholder={`${label} name`}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />

          <Button
            className="w-full"
            disabled={!file || !name.trim() || busy}
            onClick={() => file && onUpload(file, name.trim())}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <ImageUp className="h-4 w-4" />
                Upload {label.toLowerCase()}
              </>
            )}
          </Button>

          {file ? (
            <p className="text-center text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB after compression
            </p>
          ) : null}
        </div>
      )}

      {shown ? (
        <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {shown}
        </p>
      ) : null}
    </div>
  );
}

/** Downscales to fit MAX_EDGE and re-encodes as JPEG. Shared with ReceiptUpload. */
export async function compressImage(file: File, maxEdge = 1600): Promise<File> {
  // Nothing to gain on already-small files.
  if (file.size < 300 * 1024) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));

  if (scale === 1 && file.size < 1024 * 1024) {
    bitmap.close();
    return file;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) return file;

  // Keep the original if compression somehow made it larger.
  if (blob.size >= file.size) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}
