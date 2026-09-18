"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { Badge, Button, Textarea } from "@/components/ui";
import { EkycDocSlot } from "./ekyc-doc-slot";
import { updateMouNote } from "./actions";
import { approveEkyc, rejectEkyc } from "@/app/admin/masters/actions";
import type { EkycDocType, MasterApprovalStatus } from "@prisma/client";

const STATUS_TONE = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
} as const;

const STATUS_LABEL: Record<MasterApprovalStatus, string> = {
  APPROVED: "Approved",
  PENDING: "Pending review",
  REJECTED: "Rejected",
};

const DOC_LABELS: Record<EkycDocType, string> = {
  AADHAR: "Aadhar card",
  PAN: "PAN card",
  CANCELLED_CHEQUE: "Cancelled cheque",
  MOU: "MoU",
};

const DOC_ORDER: EkycDocType[] = ["AADHAR", "PAN", "CANCELLED_CHEQUE", "MOU"];

export type EkycProfileData = {
  id: string;
  approvalStatus: MasterApprovalStatus;
  rejectedReason: string | null;
  mouNote: string | null;
  documents: {
    id: string;
    docType: EkycDocType;
    fileAssetId: string;
    fileAsset: { originalName: string };
  }[];
} | null;

export function EkycSection({
  ownerType,
  ownerId,
  dealerId,
  profile,
  canReview,
}: {
  ownerType: "DEALER" | "SUBDEALER";
  ownerId: string;
  dealerId: string;
  profile: EkycProfileData;
  canReview: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState(profile?.mouNote ?? "");
  const [noteSaved, setNoteSaved] = useState(false);
  const [savingNote, startSaveNote] = useTransition();

  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewing, startReview] = useTransition();

  const docByType = new Map(
    (profile?.documents ?? []).map((d) => [d.docType, d]),
  );

  function saveNote() {
    if (!profile) return;
    setNoteSaved(false);
    startSaveNote(async () => {
      const result = await updateMouNote(dealerId, profile.id, note);
      if (result.ok) {
        setNoteSaved(true);
        router.refresh();
      }
    });
  }

  function approve() {
    if (!profile) return;
    setReviewError(null);
    startReview(async () => {
      const result = await approveEkyc(profile.id);
      if (result.ok) router.refresh();
      else setReviewError(result.error);
    });
  }

  function reject() {
    if (!profile) return;
    setReviewError(null);
    startReview(async () => {
      const result = await rejectEkyc(profile.id, reason);
      if (result.ok) {
        setShowReject(false);
        setReason("");
        router.refresh();
      } else {
        setReviewError(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-bold uppercase tracking-[0.07em] text-muted-foreground">
            eKYC
          </p>
        </div>
        <Badge tone={STATUS_TONE[profile?.approvalStatus ?? "PENDING"]}>
          {profile ? STATUS_LABEL[profile.approvalStatus] : "Not started"}
        </Badge>
      </div>

      {profile?.approvalStatus === "REJECTED" && profile.rejectedReason ? (
        <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs font-medium text-destructive">
          {profile.rejectedReason}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DOC_ORDER.map((docType) => {
          const doc = docByType.get(docType);
          return (
            <EkycDocSlot
              key={docType}
              ownerType={ownerType}
              ownerId={ownerId}
              dealerId={dealerId}
              docType={docType}
              label={DOC_LABELS[docType]}
              document={
                doc
                  ? {
                      id: doc.id,
                      fileAssetId: doc.fileAssetId,
                      fileName: doc.fileAsset.originalName,
                    }
                  : null
              }
            />
          );
        })}
      </div>

      {profile ? (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.07em] text-muted-foreground">
            MoU note
          </p>
          <Textarea
            rows={2}
            maxLength={300}
            placeholder="e.g. MoU signed 12-Aug-2026"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteSaved(false);
            }}
          />
          <div className="mt-1.5 flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={savingNote || note === (profile.mouNote ?? "")}
              onClick={saveNote}
            >
              {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save note"}
            </Button>
            {noteSaved ? (
              <span className="text-xs text-success">Saved</span>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Upload a document above to start this eKYC.
        </p>
      )}

      {canReview && profile?.approvalStatus === "PENDING" ? (
        <div className="mt-3 border-t border-border pt-3">
          {reviewError ? (
            <p className="mb-2 flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-xs font-medium text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {reviewError}
            </p>
          ) : null}

          {!showReject ? (
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" disabled={reviewing} onClick={approve}>
                {reviewing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve eKYC
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={reviewing}
                onClick={() => setShowReject(true)}
              >
                <X className="h-4 w-4" />
                Reject eKYC
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
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
                  disabled={reviewing || !reason.trim()}
                  onClick={reject}
                >
                  {reviewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirm reject"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={reviewing}
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
        </div>
      ) : null}
    </div>
  );
}
