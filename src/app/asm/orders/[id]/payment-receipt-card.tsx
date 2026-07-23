"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Wallet } from "lucide-react";
import { Card } from "@/components/ui";
import { ReceiptUpload } from "@/components/receipt-upload";
import { formatDate } from "@/lib/utils";
import { uploadPaymentReceipt } from "./upload-receipt";

type ExistingReceipt = { id: string; fileAssetId: string; uploadedAt: Date };

/** Advance-payment orders only — upload proof of payment. */
export function PaymentReceiptCard({
  orderId,
  receipts,
}: {
  orderId: string;
  receipts: ExistingReceipt[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [uploading, startTransition] = useTransition();

  function handleUpload(file: File) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("orderId", orderId);
      fd.set("file", file);

      const result = await uploadPaymentReceipt(fd);
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
        <h4 className="text-sm font-bold">Payment receipt</h4>
      </div>

      {receipts.length > 0 ? (
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

      <ReceiptUpload
        onUpload={handleUpload}
        busy={uploading}
        error={error}
      />

      <p className="mt-3 text-xs text-muted-foreground">
        Accounts verifies the receipt before dispatch proceeds.
      </p>
    </Card>
  );
}
