"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2, Wallet } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { ReceiptUpload } from "@/components/receipt-upload";
import { cn } from "@/lib/utils";
import { uploadPaymentReceipt } from "./upload-receipt";
import { deletePaymentReceipt } from "./delete-receipt";

type ExistingReceipt = {
  id: string;
  fileAssetId: string;
  uploadedAt: Date;
  fileName: string;
};

/**
 * Advance-payment orders only — add, replace, and remove payment receipts.
 *
 * Every receipt is listed individually with its own delete action, and
 * "Add" only opens the picker on demand — the confirmed list and a fresh
 * upload prompt never compete for attention at the same time.
 */
export function PaymentReceiptCard({
  orderId,
  receipts,
}: {
  orderId: string;
  receipts: ExistingReceipt[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(receipts.length === 0);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [deleting, startDelete] = useTransition();

  function handleUpload(file: File) {
    setError(null);
    startUpload(async () => {
      const fd = new FormData();
      fd.set("orderId", orderId);
      fd.set("file", file);

      const result = await uploadPaymentReceipt(fd);
      if (result.ok) {
        setShowPicker(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete(receiptId: string) {
    setError(null);
    setDeletingId(receiptId);
    startDelete(async () => {
      const result = await deletePaymentReceipt(orderId, receiptId);
      setPendingDeleteId(null);
      setDeletingId(null);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-bold">Payment receipts</h4>
        {receipts.length > 0 ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
            {receipts.length}
          </span>
        ) : null}
      </div>

      {receipts.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {receipts.map((r) => (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm transition-opacity",
                deletingId === r.id && "opacity-50",
              )}
            >
              <a
                href={`/api/files/${r.fileAssetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2 hover:text-primary"
              >
                <FileText className="h-4 w-4 shrink-0 text-success" />
                <span className="min-w-0 flex-1 truncate">
                  {r.fileName}
                </span>
              </a>

              {pendingDeleteId === r.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => handleDelete(r.id)}
                    className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/15"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setPendingDeleteId(null)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label="Delete receipt"
                  disabled={deleting}
                  onClick={() => setPendingDeleteId(r.id)}
                  className="flex h-7 w-7 min-h-0 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {!showPicker ? (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setShowPicker(true)}
        >
          <Plus className="h-4 w-4" />
          {receipts.length > 0 ? "Add another receipt" : "Add receipt"}
        </Button>
      ) : (
        <div className="space-y-3">
          {receipts.length > 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.09em] text-muted-foreground">
                New receipt
              </p>
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
            </div>
          ) : null}

          <ReceiptUpload
            onUpload={handleUpload}
            busy={uploading}
            error={error}
          />
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Accounts verifies the receipt before dispatch proceeds.
      </p>
    </Card>
  );
}
