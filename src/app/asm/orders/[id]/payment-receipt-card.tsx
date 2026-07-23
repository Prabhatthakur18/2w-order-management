"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Plus, Wallet } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { ReceiptUpload } from "@/components/receipt-upload";
import { formatDate } from "@/lib/utils";
import { uploadPaymentReceipt } from "./upload-receipt";

type ExistingReceipt = { id: string; fileAssetId: string; uploadedAt: Date };

/**
 * Advance-payment orders only — upload proof of payment.
 *
 * The picker is collapsed behind an Add/Update action once a receipt
 * exists, so the confirmed upload and a fresh camera/file prompt never
 * show at the same time — that combination reads as "did this even work?"
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
  const [uploading, startTransition] = useTransition();

  const hasReceipt = receipts.length > 0;

  function handleUpload(file: File) {
    setError(null);
    startTransition(async () => {
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

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-bold">Payment receipt</h4>
      </div>

      {hasReceipt ? (
        <div className="mb-3 space-y-2">
          {receipts.map((r) => (
            <a
              key={r.id}
              href={`/api/files/${r.fileAssetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-success/20 bg-success/5 px-3 py-2 text-sm transition-colors hover:bg-success/10"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <span className="min-w-0 flex-1 truncate">
                Receipt uploaded {formatDate(r.uploadedAt)}
              </span>
            </a>
          ))}
        </div>
      ) : null}

      {!showPicker ? (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setShowPicker(true)}
        >
          {hasReceipt ? (
            <>
              <Pencil className="h-4 w-4" />
              Update receipt
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add receipt
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-3">
          {hasReceipt ? (
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Replace receipt
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
