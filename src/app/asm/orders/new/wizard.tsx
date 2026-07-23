"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  STEPS,
  emptyDraft,
  loadDraft,
  saveDraft,
  clearDraft,
  stepStatus,
  type OrderDraft,
} from "@/lib/order-draft";
import { calculateOrder } from "@/lib/pricing";
import { formatINR, cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { StepParties } from "./step-parties";
import { StepItems } from "./step-items";
import { StepTerms } from "./step-terms";
import { StepReview } from "./step-review";
import type { DealerOption, SchemeOption, OemOption, WizardConfig } from "./types";

export function OrderWizard({
  dealers,
  oems,
  schemes,
  config,
}: {
  dealers: DealerOption[];
  oems: OemOption[];
  schemes: SchemeOption[];
  config: WizardConfig;
}) {
  const [draft, setDraft] = useState<OrderDraft>(emptyDraft);
  const [step, setStep] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Restore any in-progress draft on mount (mobile-first rule 6).
  useEffect(() => {
    const restored = loadDraft();
    setDraft(restored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveDraft(draft);
  }, [draft, hydrated]);

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
  const canAdvance =
    (step === 1 && status.parties) ||
    (step === 2 && status.items) ||
    (step === 3 && status.terms) ||
    step === 4;

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const current = STEPS[step - 1];

  return (
    <div className="pb-4">
      {/* Step rail — the connector encodes progress as a continuous path,
          which reads faster than four separate pills. */}
      <ol className="mb-6 flex items-center">
        {STEPS.map((s, i) => {
          const done = status[s.slug];
          const active = s.id === step;
          const reached = done || active;
          return (
            <li key={s.id} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => setStep(s.id)}
                aria-current={active ? "step" : undefined}
                className="group flex min-h-0 shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300",
                    active
                      ? "bg-primary text-primary-foreground shadow-glow ring-4 ring-primary/15"
                      : done
                        ? "bg-status-done/15 text-status-done"
                        : "border border-border bg-card text-muted-foreground group-hover:border-primary/30",
                  )}
                >
                  {done && !active ? <Check className="h-3.5 w-3.5" /> : s.id}
                </span>
                <span
                  className={cn(
                    "hidden text-[9px] font-bold uppercase tracking-[0.08em] transition-colors sm:block",
                    active
                      ? "text-primary"
                      : done
                        ? "text-status-done"
                        : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </button>

              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mx-1.5 -mt-4 h-0.5 flex-1 rounded-full transition-colors duration-500",
                    reached && status[STEPS[i].slug]
                      ? "bg-status-done/40"
                      : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <h3 className="font-display mb-4 text-xl font-semibold">
        {current.title}
      </h3>

      {step === 1 ? (
        <StepParties
          draft={draft}
          dealers={dealers}
          onChange={update}
        />
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

      {step === 4 ? (
        <StepReview
          draft={draft}
          dealers={dealers}
          schemes={schemes}
          totals={totals}
          onChange={update}
          onSubmitted={() => {
            clearDraft();
            setDraft(emptyDraft);
            setStep(1);
          }}
        />
      ) : null}

      {/* Sticky footer: running total + navigation */}
      <div className="sticky bottom-[76px] z-10 mt-7 md:bottom-4">
        <div className="glass-card flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-md">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              {totals.totalQty} {totals.totalQty === 1 ? "unit" : "units"}
            </p>
            <p className="font-display truncate text-lg font-semibold leading-tight tabular-nums">
              {formatINR(totals.total.toString())}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            {step > 1 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
                disabled={isPending}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            ) : null}

            {step < 4 ? (
              <Button
                size="sm"
                disabled={!canAdvance}
                onClick={() => startTransition(() => setStep((s) => s + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
