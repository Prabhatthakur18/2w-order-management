"use client";

import { useRef, useState } from "react";
import { Camera, FileUp, Loader2, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui";
import { compressImage } from "@/components/image-upload";

/**
 * Payment receipt picker: camera, file, or PDF (a bank transfer confirmation
 * is often a PDF, unlike printing-frame artwork which is always an image).
 * No label field — a receipt does not need one.
 */
export function ReceiptUpload({
  onUpload,
  busy,
  error,
}: {
  onUpload: (file: File) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;

    setLocalError(null);
    setProcessing(true);
    try {
      const isImage = picked.type.startsWith("image/");
      const finalFile = isImage ? await compressImage(picked) : picked;
      setFile(finalFile);
      setPreview(isImage ? URL.createObjectURL(finalFile) : null);
    } catch {
      setLocalError("Could not read that file. Try another one.");
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
        accept="image/jpeg,image/png,image/webp,application/pdf"
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

      {!file ? (
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
              <FileUp className="h-4 w-4" />
            )}
            Choose file
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {preview ? (
            <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Receipt preview"
                className="max-h-56 w-full object-contain"
              />
              <button
                type="button"
                onClick={clear}
                aria-label="Remove file"
                disabled={busy}
                className="absolute right-2 top-2 flex h-8 min-h-0 w-8 items-center justify-center rounded-lg bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/50 p-3">
              <span className="min-w-0 truncate text-sm font-medium">
                {file.name}
              </span>
              <button
                type="button"
                onClick={clear}
                aria-label="Remove file"
                disabled={busy}
                className="flex h-7 w-7 min-h-0 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <Button
            className="w-full"
            disabled={busy}
            onClick={() => onUpload(file)}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4" />
                Upload receipt
              </>
            )}
          </Button>
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
