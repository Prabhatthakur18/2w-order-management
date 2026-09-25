"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Search,
  Store,
  TriangleAlert,
} from "lucide-react";
import type { OrderDraft } from "@/lib/order-draft";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { ImageUpload } from "@/components/image-upload";
import { getLanguageOptions } from "@/lib/languages";
import { verifyGstin } from "@/app/asm/dealers/actions";
import { loadDealerDetail } from "./actions";
import { uploadPrintingFrame } from "./upload-frame";
import { saveContentFrame } from "./save-content-frame";
import type { DealerDetail, DealerOption } from "./types";

const emptyNewSubDealer = {
  gstin: "",
  name: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  contactNo: "",
  email: "",
  gstLegalName: "",
  gstTradeName: "",
  gstStatus: "",
  gstRegisteredAt: "",
};

type FrameMode = "IMAGE" | "CONTENT";

/**
 * Module 1 — dealer, sub-dealer, printing frame and shipping destination.
 * Dealer address auto-populates on selection, matching the existing flow.
 */
export function StepParties({
  draft,
  dealers,
  onChange,
}: {
  draft: OrderDraft;
  dealers: DealerOption[];
  onChange: (patch: Partial<OrderDraft>) => void;
}) {
  const [detail, setDetail] = useState<DealerDetail | null>(null);
  const [isPending, startTransition] = useTransition();

  // Frames created in this session — the ASM picks a mode and creates one
  // fresh each time rather than browsing dealer history (business direction).
  const [savedFrame, setSavedFrame] = useState<{
    id: string;
    label: string;
    mode: FrameMode;
    fileAssetId: string | null;
  } | null>(null);

  const [frameMode, setFrameMode] = useState<FrameMode>("IMAGE");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [contentText, setContentText] = useState("");
  const [contentLanguage, setContentLanguage] = useState("en");
  const [withOemLogo, setWithOemLogo] = useState(true);
  const [savingContent, startSaveContent] = useTransition();
  const [contentError, setContentError] = useState<string | null>(null);

  const [verifyingSubDealerGstin, startVerifySubDealerGstin] = useTransition();
  const [subDealerVerifyError, setSubDealerVerifyError] = useState<string | null>(null);
  const [subDealerVerified, setSubDealerVerified] = useState(false);

  const languageOptions = useMemo(() => getLanguageOptions(), []);

  useEffect(() => {
    if (!draft.dealerId) {
      setDetail(null);
      return;
    }
    setSavedFrame(null);
    startTransition(async () => {
      const d = await loadDealerDetail(draft.dealerId);
      setDetail(d);
    });
  }, [draft.dealerId]);

  const dealer = dealers.find((d) => d.id === draft.dealerId);

  const existingFrame = detail?.printingFrames.find(
    (f) => f.id === draft.printingFrameId,
  );
  const selectedFrame = savedFrame ?? existingFrame ?? null;

  async function handleUpload(file: File, label: string) {
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("dealerId", draft.dealerId);
      fd.set("label", label);
      fd.set("file", file);

      const result = await uploadPrintingFrame(fd);
      if (result.ok) {
        setSavedFrame({
          id: result.id,
          label: result.label,
          mode: "IMAGE",
          fileAssetId: result.fileAssetId,
        });
        onChange({ printingFrameId: result.id });
      } else {
        setUploadError(result.error);
      }
    } catch {
      setUploadError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleSaveContent() {
    setContentError(null);
    startSaveContent(async () => {
      const result = await saveContentFrame({
        dealerId: draft.dealerId,
        label: contentText.slice(0, 60) || "Printing frame content",
        contentText,
        contentLanguage,
        withOemLogo,
      });
      if (result.ok) {
        setSavedFrame({
          id: result.id,
          label: result.label,
          mode: "CONTENT",
          fileAssetId: null,
        });
        onChange({ printingFrameId: result.id });
      } else {
        setContentError(result.error);
      }
    });
  }

  function resetFrame() {
    setSavedFrame(null);
    setContentText("");
    setUploadError(null);
    setContentError(null);
    onChange({ printingFrameId: "" });
  }

  const newSubDealer = draft.newSubDealer ?? emptyNewSubDealer;

  function setNewSubDealer(patch: Partial<typeof emptyNewSubDealer>) {
    onChange({ newSubDealer: { ...newSubDealer, ...patch } });
  }

  function handleVerifySubDealerGstin() {
    setSubDealerVerifyError(null);
    setSubDealerVerified(false);
    startVerifySubDealerGstin(async () => {
      const result = await verifyGstin(newSubDealer.gstin);
      if (result.ok) {
        setNewSubDealer({
          name: newSubDealer.name || result.data.tradeName,
          address: newSubDealer.address || result.data.address,
          city: newSubDealer.city || result.data.city,
          state: newSubDealer.state || result.data.state,
          pincode: newSubDealer.pincode || result.data.pincode,
          gstLegalName: result.data.legalName,
          gstTradeName: result.data.tradeName,
          gstStatus: result.data.gstStatus,
          gstRegisteredAt: result.data.registeredAt,
        });
        setSubDealerVerified(true);
      } else {
        setSubDealerVerifyError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <Field label="Dealer" htmlFor="dealer" required>
          <Combobox
            options={dealers.map((d) => ({
              value: d.id,
              label: d.name,
              meta: d.code,
            }))}
            value={draft.dealerId}
            onChange={(v) =>
              onChange({
                dealerId: v,
                subDealerId: "",
                printingFrameId: "",
              })
            }
            placeholder="Select a dealer"
            searchPlaceholder="Search dealers…"
          />
        </Field>

        {/* Auto-populated from the dealer master */}
        {dealer ? (
          <div className="mt-3 space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
            <DealerDetailRow label="Dealer code" value={dealer.code} />
            {dealer.contactName ? (
              <DealerDetailRow
                label="Contact person"
                value={dealer.contactName}
              />
            ) : null}
            <DealerDetailRow label="Contact number" value={dealer.contactNo ?? "—"} />
            <DealerDetailRow
              label="Address"
              value={`${dealer.address}, ${dealer.city}, ${dealer.state} — ${dealer.pincode}`}
            />
            <DealerDetailRow label="GST" value={dealer.gstin ?? "—"} />
          </div>
        ) : null}
      </Card>

      {draft.dealerId ? (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-bold">Sub-dealer</h4>
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : null}
          </div>

          <Field
            label="Sub-dealer"
            htmlFor="subdealer"
            hint="Select from the master, or add a new one below."
          >
            <Combobox
              options={(detail?.subDealers ?? []).map((s) => ({
                value: s.id,
                label: s.name,
              }))}
              value={draft.subDealerId}
              onChange={(v) =>
                onChange({
                  subDealerId: v,
                  newSubDealer: v ? null : draft.newSubDealer,
                })
              }
              placeholder={
                detail?.subDealers.length
                  ? "Select a sub-dealer"
                  : "No sub-dealers on record"
              }
              searchPlaceholder="Search sub-dealers…"
              disabled={isPending}
              loading={isPending}
            />
          </Field>

          {!draft.subDealerId ? (
            <div className="mt-3 space-y-3 rounded-xl border border-dashed border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Add a new sub-dealer
              </p>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field
                    label="GSTIN"
                    htmlFor="sd-gstin"
                    hint="Optional — auto-fills the fields below."
                  >
                    <Input
                      id="sd-gstin"
                      placeholder="e.g. 09ABCDE1234F1Z5"
                      maxLength={15}
                      value={newSubDealer.gstin}
                      onChange={(e) => {
                        setNewSubDealer({ gstin: e.target.value.toUpperCase() });
                        setSubDealerVerified(false);
                      }}
                      className="font-mono uppercase"
                    />
                  </Field>
                </div>
                <Button
                  variant="secondary"
                  disabled={newSubDealer.gstin.length !== 15 || verifyingSubDealerGstin}
                  onClick={handleVerifySubDealerGstin}
                >
                  {verifyingSubDealerGstin ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-3.5 w-3.5" />
                      Verify
                    </>
                  )}
                </Button>
              </div>

              {subDealerVerifyError ? (
                <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {subDealerVerifyError}
                </p>
              ) : null}

              {subDealerVerified ? (
                <div className="space-y-1 rounded-xl bg-success/5 p-2.5 text-xs text-success">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified — fields below have been filled in and can be edited.
                  </p>
                  <p className="text-muted-foreground">
                    Legal name: {newSubDealer.gstLegalName} · Status: {newSubDealer.gstStatus}
                  </p>
                </div>
              ) : null}

              <Field label="Name" htmlFor="sd-name">
                <Input
                  id="sd-name"
                  value={newSubDealer.name}
                  onChange={(e) => setNewSubDealer({ name: e.target.value })}
                />
              </Field>
              <Field label="Address" htmlFor="sd-addr">
                <Textarea
                  id="sd-addr"
                  value={newSubDealer.address}
                  onChange={(e) => setNewSubDealer({ address: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" htmlFor="sd-city">
                  <Input
                    id="sd-city"
                    value={newSubDealer.city}
                    onChange={(e) => setNewSubDealer({ city: e.target.value })}
                  />
                </Field>
                <Field label="Pincode" htmlFor="sd-pincode">
                  <Input
                    id="sd-pincode"
                    inputMode="numeric"
                    maxLength={6}
                    value={newSubDealer.pincode}
                    onChange={(e) =>
                      setNewSubDealer({ pincode: e.target.value.replace(/\D/g, "") })
                    }
                  />
                </Field>
              </div>
              <Field label="State" htmlFor="sd-state">
                <Input
                  id="sd-state"
                  value={newSubDealer.state}
                  onChange={(e) => setNewSubDealer({ state: e.target.value })}
                />
              </Field>
              <Field label="Contact number" htmlFor="sd-contact">
                <Input
                  id="sd-contact"
                  type="tel"
                  inputMode="tel"
                  value={newSubDealer.contactNo}
                  onChange={(e) => setNewSubDealer({ contactNo: e.target.value })}
                />
              </Field>
              <Field label="Email" htmlFor="sd-email">
                <Input
                  id="sd-email"
                  type="email"
                  value={newSubDealer.email}
                  onChange={(e) => setNewSubDealer({ email: e.target.value })}
                />
              </Field>
            </div>
          ) : null}
        </Card>
      ) : null}

      {draft.dealerId ? (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-bold">Printing frame</h4>
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : null}
          </div>

          {selectedFrame ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-success/20 bg-success/5 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium">
                  {selectedFrame.mode === "IMAGE" ? "Image" : "Content"} saved
                  — {selectedFrame.label}
                </span>
                <button
                  type="button"
                  onClick={resetFrame}
                  className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Change
                </button>
              </div>

              {selectedFrame.fileAssetId ? (
                <div className="overflow-hidden rounded-xl border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${selectedFrame.fileAssetId}`}
                    alt={`${selectedFrame.label} artwork`}
                    className="max-h-48 w-full object-contain"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mode toggle — checkbox-style choice between an image or typed content. */}
              <div className="grid grid-cols-2 gap-2.5">
                <ModeOption
                  selected={frameMode === "IMAGE"}
                  label="Image"
                  onClick={() => setFrameMode("IMAGE")}
                />
                <ModeOption
                  selected={frameMode === "CONTENT"}
                  label="Content"
                  onClick={() => setFrameMode("CONTENT")}
                />
              </div>

              {frameMode === "IMAGE" ? (
                <ImageUpload
                  label="Artwork"
                  busy={uploading}
                  error={uploadError}
                  onUpload={handleUpload}
                />
              ) : (
                <div className="space-y-3">
                  <Field label="Content" htmlFor="frame-content" required>
                    <Textarea
                      id="frame-content"
                      rows={3}
                      maxLength={2000}
                      placeholder="Text to be printed"
                      value={contentText}
                      onChange={(e) => setContentText(e.target.value)}
                    />
                  </Field>

                  <Field label="Language" htmlFor="frame-language" required>
                    <Combobox
                      options={languageOptions.map((l) => ({
                        value: l.code,
                        label: l.name,
                      }))}
                      value={contentLanguage}
                      onChange={setContentLanguage}
                      placeholder="Select language"
                      searchPlaceholder="Search languages…"
                    />
                  </Field>

                  <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                      checked={withOemLogo}
                      onChange={(e) => setWithOemLogo(e.target.checked)}
                    />
                    With OEM logo
                  </label>

                  {contentError ? (
                    <p className="rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive">
                      {contentError}
                    </p>
                  ) : null}

                  <Button
                    className="w-full"
                    disabled={!contentText.trim() || savingContent}
                    onClick={handleSaveContent}
                  >
                    {savingContent ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Save content
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      ) : null}

      {draft.dealerId ? (
        <Card>
          <h4 className="mb-3 text-sm font-bold">Shipping address</h4>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
              checked={draft.shippingSameAsDealer}
              onChange={(e) =>
                onChange({ shippingSameAsDealer: e.target.checked })
              }
            />
            Same as dealer address
          </label>

          {!draft.shippingSameAsDealer ? (
            <div className="mt-3 space-y-3">
              <Field label="Address" htmlFor="ship-addr" required>
                <Textarea
                  id="ship-addr"
                  value={draft.shippingAddress}
                  onChange={(e) =>
                    onChange({ shippingAddress: e.target.value })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" htmlFor="ship-city">
                  <Input
                    id="ship-city"
                    value={draft.shippingCity}
                    onChange={(e) => onChange({ shippingCity: e.target.value })}
                  />
                </Field>
                <Field label="Pincode" htmlFor="ship-pin">
                  <Input
                    id="ship-pin"
                    inputMode="numeric"
                    maxLength={6}
                    value={draft.shippingPincode}
                    onChange={(e) =>
                      onChange({ shippingPincode: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="State" htmlFor="ship-state">
                <Input
                  id="ship-state"
                  value={draft.shippingState}
                  onChange={(e) => onChange({ shippingState: e.target.value })}
                />
              </Field>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function DealerDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-start justify-between gap-3 text-muted-foreground">
      <span className="shrink-0 text-xs font-bold uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </p>
  );
}

function ModeOption({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
        selected
          ? "border-primary bg-primary/5 text-primary"
          : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          selected ? "border-primary bg-primary" : "border-input"
        }`}
      >
        {selected ? (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-primary-foreground" fill="currentColor">
            <path d="M10 2 4.5 8 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      {label}
    </button>
  );
}
