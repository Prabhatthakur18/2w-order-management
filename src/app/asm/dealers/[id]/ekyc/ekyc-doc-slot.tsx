"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { ReceiptUpload } from "@/components/receipt-upload";
import { uploadEkycDocument, deleteEkycDocument } from "./actions";
import type { EkycDocType } from "@prisma/client";

type ExistingDoc = {
  id: string;
  fileAssetId: string;
  fileName: string;
} | null;

/** One eKYC document type — Aadhar, PAN, cancelled cheque, or MoU. One file
 * per slot; uploading again replaces whatever is there. */
export function EkycDocSlot({
  ownerType,
  ownerId,
  dealerId,
  docType,
  label,
  document,
}: {
  ownerType: "DEALER" | "SUBDEALER";
  ownerId: string;
  dealerId: string;
  docType: EkycDocType;
  label: string;
  document: ExistingDoc;
}) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [deleting, startDelete] = useTransition();

  function handleUpload(file: File) {
    setError(null);
    startUpload(async () => {
      const fd = new FormData();
      fd.set("ownerType", ownerType);
      fd.set("ownerId", ownerId);
      fd.set("dealerId", dealerId);
      fd.set("docType", docType);
      fd.set("file", file);

      const result = await uploadEkycDocument(fd);
      if (result.ok) {
        setShowPicker(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    if (!document) return;
    setError(null);
    startDelete(async () => {
      const result = await deleteEkycDocument(dealerId, document.id);
      setPendingDelete(false);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold">{label}</p>
        {document && !showPicker ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowPicker(true)}
          >
            Replace
          </Button>
        ) : null}
      </div>

      {document && !showPicker ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-sm">
          <a
            href={`/api/files/${document.fileAssetId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-1 items-center gap-2 hover:text-primary"
          >
            <FileText className="h-4 w-4 shrink-0 text-success" />
            <span className="min-w-0 flex-1 truncate">{document.fileName}</span>
          </a>

          {pendingDelete ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/15"
              >
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(false)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label={`Delete ${label}`}
              disabled={deleting}
              onClick={() => setPendingDelete(true)}
              className="flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : null}

      {!document && !showPicker ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-2 w-full"
          onClick={() => setShowPicker(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Upload
        </Button>
      ) : null}

      {showPicker ? (
        <div className="mt-2 space-y-2">
          {document ? (
            <button
              type="button"
              onClick={() => {
                setShowPicker(false);
                setError(null);
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          ) : null}
          <ReceiptUpload onUpload={handleUpload} busy={uploading} error={null} />
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-xs font-medium text-destructive">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
