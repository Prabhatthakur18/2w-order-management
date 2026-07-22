"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, MapPin, Store } from "lucide-react";
import type { OrderDraft } from "@/lib/order-draft";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { loadDealerDetail } from "./actions";
import type { DealerDetail, DealerOption } from "./types";

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

  useEffect(() => {
    if (!draft.dealerId) {
      setDetail(null);
      return;
    }
    startTransition(async () => {
      const d = await loadDealerDetail(draft.dealerId);
      setDetail(d);
    });
  }, [draft.dealerId]);

  const dealer = dealers.find((d) => d.id === draft.dealerId);

  return (
    <div className="space-y-4">
      <Card>
        <Field label="Dealer" htmlFor="dealer" required>
          <Select
            id="dealer"
            value={draft.dealerId}
            onChange={(e) =>
              onChange({
                dealerId: e.target.value,
                subDealerId: "",
                printingFrameId: "",
              })
            }
          >
            <option value="">Select a dealer</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </Select>
        </Field>

        {/* Auto-populated from the dealer master */}
        {dealer ? (
          <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm">
            <p className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {dealer.address}, {dealer.city}, {dealer.state} —{" "}
                {dealer.pincode}
                <br />
                <span className="text-xs">Contact: {dealer.contactNo}</span>
              </span>
            </p>
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
            <Select
              id="subdealer"
              value={draft.subDealerId}
              onChange={(e) =>
                onChange({
                  subDealerId: e.target.value,
                  newSubDealer: e.target.value ? null : draft.newSubDealer,
                })
              }
              disabled={isPending}
            >
              <option value="">
                {detail?.subDealers.length
                  ? "Select a sub-dealer"
                  : "No sub-dealers on record"}
              </option>
              {detail?.subDealers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          {!draft.subDealerId ? (
            <div className="mt-3 space-y-3 rounded-xl border border-dashed border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Add a new sub-dealer
              </p>
              <Field label="Name" htmlFor="sd-name">
                <Input
                  id="sd-name"
                  value={draft.newSubDealer?.name ?? ""}
                  onChange={(e) =>
                    onChange({
                      newSubDealer: {
                        name: e.target.value,
                        address: draft.newSubDealer?.address ?? "",
                        contactNo: draft.newSubDealer?.contactNo ?? "",
                      },
                    })
                  }
                />
              </Field>
              <Field label="Address" htmlFor="sd-addr">
                <Textarea
                  id="sd-addr"
                  value={draft.newSubDealer?.address ?? ""}
                  onChange={(e) =>
                    onChange({
                      newSubDealer: {
                        name: draft.newSubDealer?.name ?? "",
                        address: e.target.value,
                        contactNo: draft.newSubDealer?.contactNo ?? "",
                      },
                    })
                  }
                />
              </Field>
              <Field label="Contact number" htmlFor="sd-contact">
                <Input
                  id="sd-contact"
                  type="tel"
                  inputMode="tel"
                  value={draft.newSubDealer?.contactNo ?? ""}
                  onChange={(e) =>
                    onChange({
                      newSubDealer: {
                        name: draft.newSubDealer?.name ?? "",
                        address: draft.newSubDealer?.address ?? "",
                        contactNo: e.target.value,
                      },
                    })
                  }
                />
              </Field>
            </div>
          ) : null}
        </Card>
      ) : null}

      {draft.dealerId ? (
        <Card>
          <Field
            label="Printing frame"
            htmlFor="frame"
            hint="Stored against the dealer and reused across orders."
          >
            <Select
              id="frame"
              value={draft.printingFrameId}
              onChange={(e) => onChange({ printingFrameId: e.target.value })}
              disabled={isPending}
            >
              <option value="">
                {detail?.printingFrames.length
                  ? "Select artwork"
                  : "No artwork on file"}
              </option>
              {detail?.printingFrames.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                  {f.isDefault ? " (default)" : ""}
                </option>
              ))}
            </Select>
          </Field>
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
