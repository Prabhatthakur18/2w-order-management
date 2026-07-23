import Link from "next/link";
import { Plus } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-[1.75rem] font-semibold leading-tight">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="group flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow transition-all duration-300 hover:brightness-110 active:scale-95"
        >
          <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
          <span className="hidden sm:inline">{action.label}</span>
        </Link>
      ) : null}
    </div>
  );
}

const STAT_TONE = {
  default: { rail: "hsl(var(--status-placed))", text: "text-foreground" },
  warn: { rail: "hsl(var(--status-created))", text: "text-status-created" },
  good: { rail: "hsl(var(--status-done))", text: "text-status-done" },
  idle: { rail: "hsl(var(--status-draft))", text: "text-muted-foreground" },
} as const;

/**
 * KPI tile. The rail encodes severity in form as well as colour, so a row of
 * these reads at a glance rather than needing to be parsed number by number.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  attention = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: keyof typeof STAT_TONE;
  /** Draws a live indicator — use only when the number needs acting on. */
  attention?: boolean;
}) {
  const t = STAT_TONE[tone];
  const isZero = value === 0 || value === "0";

  return (
    <div
      className="rail card-hover group relative rounded-2xl border border-border bg-card p-4 shadow-sm"
      style={{ "--rail-color": isZero ? "hsl(var(--border))" : t.rail } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
          {label}
        </p>
        {attention && !isZero ? (
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-60"
              style={{ background: t.rail, animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite" }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: t.rail }}
            />
          </span>
        ) : null}
      </div>

      <p
        className={`font-display mt-2.5 text-[2rem] font-semibold leading-none tabular-nums ${
          isZero ? "text-muted-foreground/40" : t.text
        }`}
      >
        {value}
      </p>

      {hint ? (
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3.5 flex items-center gap-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
          {title}
        </h3>
        {/* Rule carries the eye across to the action, and separates bands. */}
        <span className="h-px flex-1 bg-border" aria-hidden />
        {action}
      </div>
      {children}
    </section>
  );
}

/** Marks work that lands in a later phase, so the shell reads honestly. */
export function PhaseNote({
  phase,
  children,
}: {
  phase: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.09em] text-primary">
        <span className="h-1 w-1 rounded-full bg-primary" aria-hidden />
        {phase}
      </span>
      <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
