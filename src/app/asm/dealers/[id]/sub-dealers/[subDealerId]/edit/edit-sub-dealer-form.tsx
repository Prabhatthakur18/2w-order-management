"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  Search,
  TriangleAlert,
} from "lucide-react";
import { Button, Card, Field, Input } from "@/components/ui";
import { verifyGstin, updateSubDealer } from "../../../../actions";

type FormState = {
  gstin: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactNo: string;
  email: string;
  gstLegalName: string;
  gstTradeName: string;
  gstStatus: string;
  gstRegisteredAt: string;
};

/**
 * Editing an already-APPROVED/REJECTED sub-dealer resets it to PENDING for
 * Admin re-review — mirrors NewSubDealerForm, pre-populated, calling
 * updateSubDealer instead of createSubDealer.
 */
export function EditSubDealerForm({
  dealerId,
  subDealerId,
  initial,
}: {
  dealerId: string;
  subDealerId: string;
  initial: FormState;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [verifying, startVerify] = useTransition();
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleVerify() {
    setVerifyError(null);
    setVerified(false);
    startVerify(async () => {
      const result = await verifyGstin(form.gstin);
      if (result.ok) {
        setForm((f) => ({
          ...f,
          name: f.name || result.data.tradeName,
          address: f.address || result.data.address,
          city: f.city || result.data.city,
          state: f.state || result.data.state,
          pincode: f.pincode || result.data.pincode,
          gstLegalName: result.data.legalName,
          gstTradeName: result.data.tradeName,
          gstStatus: result.data.gstStatus,
          gstRegisteredAt: result.data.registeredAt,
        }));
        setVerified(true);
      } else {
        setVerifyError(result.error);
      }
    });
  }

  function handleSubmit() {
    setSubmitError(null);
    setFieldErrors({});
    startSubmit(async () => {
      const result = await updateSubDealer(subDealerId, form);
      if (result.ok) {
        router.push(`/asm/dealers/${dealerId}/sub-dealers/${subDealerId}`);
      } else {
        setSubmitError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  const canSubmit = form.name.trim() && form.address.trim() && form.contactNo.trim();

  return (
    <div className="space-y-4 pb-8">
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-bold">GST lookup</h4>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="GSTIN" htmlFor="gstin" hint="Optional — auto-fills the fields below.">
              <Input
                id="gstin"
                placeholder="e.g. 09ABCDE1234F1Z5"
                maxLength={15}
                value={form.gstin}
                onChange={(e) => {
                  set("gstin", e.target.value.toUpperCase());
                  setVerified(false);
                }}
                className="font-mono uppercase"
              />
            </Field>
          </div>
          <Button
            variant="secondary"
            disabled={form.gstin.length !== 15 || verifying}
            onClick={handleVerify}
          >
            {verifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Verify"
            )}
          </Button>
        </div>

        {verifyError ? (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {verifyError}
          </p>
        ) : null}

        {verified ? (
          <div className="mt-2 space-y-1 rounded-xl bg-success/5 p-3 text-xs text-success">
            <p className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verified — fields below have been filled in and can be edited.
            </p>
            <p className="text-muted-foreground">
              Legal name: {form.gstLegalName} · Status: {form.gstStatus}
            </p>
          </div>
        ) : null}
      </Card>

      <Card>
        <h4 className="mb-3 text-sm font-bold">Sub-dealer details</h4>
        <div className="space-y-3">
          <Field label="Name" htmlFor="name" required error={fieldErrors.name}>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>

          <Field label="Address" htmlFor="address" required error={fieldErrors.address}>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City" htmlFor="city">
              <Input
                id="city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
            <Field label="Pincode" htmlFor="pincode" error={fieldErrors.pincode}>
              <Input
                id="pincode"
                inputMode="numeric"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </div>

          <Field label="State" htmlFor="state">
            <Input
              id="state"
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <h4 className="mb-3 text-sm font-bold">Contact</h4>
        <div className="space-y-3">
          <Field
            label="Contact number"
            htmlFor="contactNo"
            required
            error={fieldErrors.contactNo}
          >
            <Input
              id="contactNo"
              type="tel"
              inputMode="tel"
              value={form.contactNo}
              onChange={(e) => set("contactNo", e.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={fieldErrors.email}>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
        </div>
      </Card>

      {submitError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {submitError}
        </p>
      ) : null}

      <Button
        className="w-full"
        size="lg"
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Save changes
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        If this sub-dealer was already approved, saving changes sends it back
        to Admin for re-review.
      </p>
    </div>
  );
}
