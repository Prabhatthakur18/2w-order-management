"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button, Card, Textarea } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  approveDealer,
  rejectDealer,
  approveSubDealer,
  rejectSubDealer,
  approveEkyc,
  rejectEkyc,
} from "./actions";

type PendingDealer = {
  id: string;
  code: string;
  name: string;
  gstin: string | null;
  gstLegalName: string | null;
  gstStatus: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string | null;
  contactNo: string;
  email: string | null;
  createdAt: string;
  createdByName: string;
};

export function PendingDealerRow({ dealer }: { dealer: PendingDealer }) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await approveDealer(dealer.id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectDealer(dealer.id, reason);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <Card className="rail" style={{ "--rail-color": "hsl(var(--warning))" } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{dealer.name}</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {dealer.code}
            {dealer.gstin ? ` · ${dealer.gstin}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">
          {formatDate(dealer.createdAt)}
        </p>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {dealer.address}, {dealer.city}, {dealer.state} — {dealer.pincode}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span>
            {dealer.contactName ? `${dealer.contactName} — ` : ""}
            {dealer.contactNo}
          </span>
        </p>
        {dealer.email ? (
          <p className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span>{dealer.email}</span>
          </p>
        ) : null}
        {dealer.gstLegalName ? (
          <p className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              {dealer.gstLegalName}
              {dealer.gstStatus ? ` (${dealer.gstStatus})` : ""}
            </span>
          </p>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Added by {dealer.createdByName}
      </p>

      {error ? (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {!showReject ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" disabled={pending} onClick={approve}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => setShowReject(true)}
          >
            <X className="h-4 w-4" />
            Reject
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={2}
            maxLength={300}
            placeholder="Reason for rejecting (shown to the ASM)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={pending || !reason.trim()}
              onClick={reject}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm reject"
              )}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setShowReject(false);
                setReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

type PendingSubDealer = {
  id: string;
  name: string;
  dealerName: string;
  address: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contactNo: string;
  email: string | null;
  createdAt: string;
  createdByName: string;
};

export function PendingSubDealerRow({
  subDealer,
}: {
  subDealer: PendingSubDealer;
}) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await approveSubDealer(subDealer.id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectSubDealer(subDealer.id, reason);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  const location = [subDealer.city, subDealer.state, subDealer.pincode]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className="rail" style={{ "--rail-color": "hsl(var(--warning))" } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{subDealer.name}</p>
          <p className="text-[11px] text-muted-foreground">
            Under {subDealer.dealerName}
          </p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">
          {formatDate(subDealer.createdAt)}
        </p>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {subDealer.address}
            {location ? `, ${location}` : ""}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span>{subDealer.contactNo}</span>
        </p>
        {subDealer.email ? (
          <p className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span>{subDealer.email}</span>
          </p>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Added by {subDealer.createdByName}
      </p>

      {error ? (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {!showReject ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" disabled={pending} onClick={approve}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => setShowReject(true)}
          >
            <X className="h-4 w-4" />
            Reject
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={2}
            maxLength={300}
            placeholder="Reason for rejecting (shown to the ASM)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={pending || !reason.trim()}
              onClick={reject}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm reject"
              )}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setShowReject(false);
                setReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

type PendingEkyc = {
  id: string;
  ownerName: string;
  ownerKind: "Dealer" | "Sub-dealer";
  mouNote: string | null;
  createdAt: string;
  documents: { id: string; docType: string; fileAssetId: string; fileName: string }[];
};

const EKYC_DOC_LABELS: Record<string, string> = {
  AADHAR: "Aadhar card",
  PAN: "PAN card",
  CANCELLED_CHEQUE: "Cancelled cheque",
  MOU: "MoU",
};

export function PendingEkycRow({ ekyc }: { ekyc: PendingEkyc }) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await approveEkyc(ekyc.id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectEkyc(ekyc.id, reason);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <Card className="rail" style={{ "--rail-color": "hsl(var(--warning))" } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{ekyc.ownerName}</p>
          <p className="text-[11px] text-muted-foreground">{ekyc.ownerKind}</p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">
          {formatDate(ekyc.createdAt)}
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        {ekyc.documents.length === 0 ? (
          <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          ekyc.documents.map((d) => (
            <a
              key={d.id}
              href={`/api/files/${d.fileAssetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-success" />
              <span className="font-medium text-foreground">
                {EKYC_DOC_LABELS[d.docType] ?? d.docType}
              </span>
              <span className="min-w-0 flex-1 truncate">{d.fileName}</span>
            </a>
          ))
        )}
      </div>

      {ekyc.mouNote ? (
        <p className="mt-2 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">MoU note: </span>
          {ekyc.mouNote}
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {!showReject ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" disabled={pending} onClick={approve}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => setShowReject(true)}
          >
            <X className="h-4 w-4" />
            Reject
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={2}
            maxLength={300}
            placeholder="Reason for rejecting (shown to the ASM)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={pending || !reason.trim()}
              onClick={reject}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm reject"
              )}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setShowReject(false);
                setReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
