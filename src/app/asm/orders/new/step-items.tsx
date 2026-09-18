"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Package, Plus, Trash2, TriangleAlert } from "lucide-react";
import type { OrderDraft, OrderLineDraft } from "@/lib/order-draft";
import { Button, Card, EmptyState, Field, Input, Textarea } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { formatINR } from "@/lib/utils";
import { loadVehicles, loadParts, loadColours, loadPrice } from "./actions";
import type { OemOption } from "./types";

type Option = { id: string; name: string; code?: string };
type PartOption = {
  id: string;
  partNo: string;
  name: string;
  packingUnit: "PC" | "SET";
  gstRatePct: string;
};
type ColourOption = { id: string; colour: string; productCode: string };

/**
 * Module 2 — cascading catalog selection. Each level is fetched from the
 * server filtered by its parent, so the lists are never unfiltered.
 */
export function StepItems({
  draft,
  oems,
  onChange,
}: {
  draft: OrderDraft;
  oems: OemOption[];
  onChange: (patch: Partial<OrderDraft>) => void;
}) {
  const [oemId, setOemId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [partId, setPartId] = useState("");
  const [colourId, setColourId] = useState("");
  const [qty, setQty] = useState("1");
  const [lineRemarks, setLineRemarks] = useState("");

  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [parts, setParts] = useState<PartOption[]>([]);
  const [colours, setColours] = useState<ColourOption[]>([]);
  const [price, setPrice] = useState<string | null>(null);
  const [priceMissing, setPriceMissing] = useState(false);

  const [pending, startTransition] = useTransition();

  // Each selection resets everything downstream.
  useEffect(() => {
    setVehicleId("");
    setPartId("");
    setColourId("");
    setParts([]);
    setColours([]);
    if (!oemId) {
      setVehicles([]);
      return;
    }
    startTransition(async () => setVehicles(await loadVehicles(oemId)));
  }, [oemId]);

  useEffect(() => {
    setPartId("");
    setColourId("");
    setColours([]);
    if (!vehicleId) {
      setParts([]);
      return;
    }
    startTransition(async () => setParts(await loadParts(vehicleId)));
  }, [vehicleId]);

  useEffect(() => {
    setColourId("");
    if (!partId) {
      setColours([]);
      return;
    }
    startTransition(async () => setColours(await loadColours(partId)));
  }, [partId]);

  useEffect(() => {
    setPrice(null);
    setPriceMissing(false);
    if (!colourId) return;
    startTransition(async () => {
      const p = await loadPrice(colourId, null);
      if (p) setPrice(p.unitPrice);
      else setPriceMissing(true);
    });
  }, [colourId]);

  const part = parts.find((p) => p.id === partId);
  const colour = colours.find((c) => c.id === colourId);
  const oem = oems.find((o) => o.id === oemId);
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const qtyNum = Number(qty);

  const canAdd =
    Boolean(colour && part && oem && vehicle && price) &&
    Number.isInteger(qtyNum) &&
    qtyNum > 0;

  function addLine() {
    if (!canAdd || !colour || !part || !oem || !vehicle || !price) return;

    const line: OrderLineDraft = {
      key: `${colour.id}-${Date.now()}`,
      oemId: oem.id,
      oemName: oem.name,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      partId: part.id,
      partNo: part.partNo,
      partName: part.name,
      partColourId: colour.id,
      colour: colour.colour,
      productCode: colour.productCode,
      packingUnit: part.packingUnit,
      qty: qtyNum,
      unitPrice: price,
      gstRatePct: part.gstRatePct,
      remarks: lineRemarks.trim(),
    };

    // Same SKU merges quantities — but only when neither carries a distinct
    // remark, since different instructions must stay on separate lines.
    const existing = draft.lines.findIndex(
      (l) =>
        l.partColourId === line.partColourId &&
        !l.remarks &&
        !line.remarks,
    );
    if (existing >= 0) {
      const next = [...draft.lines];
      next[existing] = {
        ...next[existing],
        qty: next[existing].qty + line.qty,
      };
      onChange({ lines: next });
    } else {
      onChange({ lines: [...draft.lines, line] });
    }

    setColourId("");
    setQty("1");
    setLineRemarks("");
  }

  function setLineRemark(key: string, remarks: string) {
    onChange({
      lines: draft.lines.map((l) =>
        l.key === key ? { ...l, remarks: remarks.slice(0, 500) } : l,
      ),
    });
  }

  function removeLine(key: string) {
    onChange({ lines: draft.lines.filter((l) => l.key !== key) });
  }

  function setLineQty(key: string, next: number) {
    if (!Number.isInteger(next) || next < 1) return;
    onChange({
      lines: draft.lines.map((l) => (l.key === key ? { ...l, qty: next } : l)),
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-bold">Add item</h4>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        <div className="space-y-3">
          <Field label="OEM" htmlFor="oem" required>
            <Combobox
              options={oems.map((o) => ({ value: o.id, label: o.name }))}
              value={oemId}
              onChange={setOemId}
              placeholder="Select OEM"
              searchPlaceholder="Search OEMs…"
            />
          </Field>

          <Field label="Vehicle" htmlFor="vehicle" required>
            <Combobox
              options={vehicles.map((v) => ({ value: v.id, label: v.name }))}
              value={vehicleId}
              onChange={setVehicleId}
              placeholder={oemId ? "Select vehicle" : "Select an OEM first"}
              searchPlaceholder="Search vehicles…"
              disabled={!oemId || pending}
            />
          </Field>

          <Field label="Part number" htmlFor="part" required>
            <Combobox
              options={parts.map((p) => ({
                value: p.id,
                label: p.name,
                meta: p.partNo,
              }))}
              value={partId}
              onChange={setPartId}
              placeholder={vehicleId ? "Select part" : "Select a vehicle first"}
              searchPlaceholder="Search parts or part no…"
              disabled={!vehicleId || pending}
            />
          </Field>

          <Field label="Colour" htmlFor="colour" required>
            <Combobox
              options={colours.map((c) => ({ value: c.id, label: c.colour }))}
              value={colourId}
              onChange={setColourId}
              placeholder={partId ? "Select colour" : "Select a part first"}
              searchPlaceholder="Search colours…"
              disabled={!partId || pending}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`Quantity${part ? ` (${part.packingUnit})` : ""}`}
              htmlFor="qty"
              required
            >
              <Input
                id="qty"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </Field>
            <Field label="Unit price" htmlFor="price">
              <Input
                id="price"
                readOnly
                value={price ? formatINR(price) : "—"}
                className="bg-muted/50"
              />
            </Field>
          </div>

          {priceMissing ? (
            <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs font-medium text-warning">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              No active price for this item. Admin must add one before it can be
              ordered.
            </p>
          ) : null}

          <Field
            label="Item remarks"
            htmlFor="line-remarks"
            hint="Optional — packing, finish or handling notes for this item."
          >
            <Textarea
              id="line-remarks"
              rows={2}
              maxLength={500}
              placeholder="e.g. pack separately, matte finish"
              value={lineRemarks}
              onChange={(e) => setLineRemarks(e.target.value)}
            />
          </Field>

          {part ? (
            <p className="text-xs text-muted-foreground">
              Part no:{" "}
              <span className="font-mono font-semibold">{part.partNo}</span>
            </p>
          ) : null}

          <Button className="w-full" disabled={!canAdd} onClick={addLine}>
            <Plus className="h-4 w-4" />
            Add to order
          </Button>
        </div>
      </Card>

      {draft.lines.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="No items yet"
          description="Add at least one item to continue."
        />
      ) : (
        <div className="space-y-2.5">
          {draft.lines.map((l) => (
            <Card key={l.key} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {l.partNo} — {l.partName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.oemName} · {l.vehicleName} · {l.colour}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {l.partNo}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(l.key)}
                  aria-label={`Remove ${l.partNo}`}
                  className="flex h-8 min-h-0 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLineQty(l.key, l.qty - 1)}
                    disabled={l.qty <= 1}
                    aria-label="Decrease quantity"
                    className="h-8 min-h-0 w-8 rounded-lg border border-border text-sm font-bold disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-sm font-semibold tabular-nums">
                    {l.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLineQty(l.key, l.qty + 1)}
                    aria-label="Increase quantity"
                    className="h-8 min-h-0 w-8 rounded-lg border border-border text-sm font-bold"
                  >
                    +
                  </button>
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {l.packingUnit}
                  </span>
                </div>

                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {formatINR(l.unitPrice)} each
                  </p>
                  <p className="text-sm font-bold tabular-nums">
                    {formatINR(String(Number(l.unitPrice) * l.qty))}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 border-t border-border pt-2.5">
                <label
                  htmlFor={`remark-${l.key}`}
                  className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Item remarks
                </label>
                <Textarea
                  id={`remark-${l.key}`}
                  rows={2}
                  maxLength={500}
                  placeholder="Optional note for this item"
                  value={l.remarks}
                  onChange={(e) => setLineRemark(l.key, e.target.value)}
                  className="text-sm"
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
