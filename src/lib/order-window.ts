/**
 * Pure edit-window helpers — no database, no server-only import, so client
 * components can use them too. Database operations live in order-lifecycle.ts.
 */

export const DEFAULT_EDIT_WINDOW_HOURS = 24;

export function editDeadline(from: Date, hours: number): Date {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

/** An order is editable only while CREATED and before its deadline. */
export function isEditable(order: {
  status: string;
  editableUntil: Date | null;
}): boolean {
  if (order.status !== "CREATED") return false;
  if (!order.editableUntil) return false;
  return order.editableUntil.getTime() > Date.now();
}

export function msRemaining(editableUntil: Date | null): number {
  if (!editableUntil) return 0;
  return Math.max(0, editableUntil.getTime() - Date.now());
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "Window closed";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) return `${hours}h ${minutes}m left to edit`;
  return `${minutes}m left to edit`;
}

/** Indian financial year: April to March. */
export function financialYear(d: Date): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}
