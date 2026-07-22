"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  TriangleAlert,
} from "lucide-react";
import { STEPS, stepStatus, type OrderDraft } from "@/lib/order-draft";
import { calculateOrder } from "@/lib/pricing";
import { formatINR, cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { StepParties } from "../../new/step-parties";
import { StepItems } from "../../new/step-items";
import { StepTerms } from "../../new/step-terms";
import type {
  DealerOption,
  OemOption,
  SchemeOption,
  WizardConfig,
} from "../../new/types";
import { updateOrder } from "./update-order";

/**
 * Edit wizard for an order inside its edit window.
 *
 * Reuses the creation steps, but holds the draft in memory rather than
 * localStorage — this edits a specific saved order, so a stale browser draft
 * must never leak across orders.
 */
export function EditOrderWizard({
  orderId,
  initialDraft,
  dealers,
  oems,
  schemes,
  config,
}: {
  orderId: string;
  initialDraft: OrderDraft;
  dealers: DealerOption[];
  oems: OemOption[];
  schemes: SchemeOption[];
  config: WizardConfig;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<OrderDraft>(initialDraft);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<OrderDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const scheme = schemes.find((s) => s.id === draft.schemeId);
  const totals = useMemo(
    () =>
      calculateOrder(draft.lines, {
        dealerDiscountPct: draft.dealerDiscountPct,
        schemeDiscountPct: scheme?.discountPct ?? "0",
        schemeFlatAmount: scheme?.flatAmount ?? "0",
      }),
    [draft.lines, draft.dealerDiscountPct, scheme],
  );

  const status = stepStatus(draft);
  const editSteps = STEPS.slice(0, 3);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateOrder(orderId, draft);
      if (result.ok) {
        router.push(`/asm/orders/${orderId}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="pb-4">
      <ol className="mb-5 flex items-center gap-1.5">
        {editSteps.map((s) => {
          const done = status[s.slug];
          const active = s.id === step;
          return (
            <li key={s.id} className="flex flex-1 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  "flex h-8 min-h-0 w-full items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-bold uppercase tracking-wider transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                    : done
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done && !active ? <Check className="h-3 w-3" /> : <span>{s.id}</span>}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <h3 className="mb-4 text-lg font-bold">{editSteps[step - 1].title}</h3>

      {step === 1 ? (
        <StepParties draft={draft} dealers={dealers} onChange={update} />
      ) : null}
      {step === 2 ? (
        <StepItems draft={draft} oems={oems} onChange={update} />
      ) : null}
      {step === 3 ? (
        <StepTerms
          draft={draft}
          schemes={schemes}
          config={config}
          totals={totals}
          onChange={update}
        />
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-[76px] z-10 mt-6 md:bottom-4">
        <div className="glass-card flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {totals.totalQty} {totals.totalQty === 1 ? "unit" : "units"}
            </p>
            <p className="truncate text-base font-bold tabular-nums">
              {formatINR(totals.total.toString())}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            {step > 1 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
                disabled={pending}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : null}

            {step < 3 ? (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={pending || draft.lines.length === 0}
                onClick={save}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save changes
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
