/**
 * Order lifecycle assertions. Run with: npm run test:lifecycle
 *
 * Covers the edit-window logic and the CREATED -> PLACED transition guard.
 */
import Module from "node:module";

const originalRequire = Module.prototype.require;
// @ts-expect-error deliberate test shim
Module.prototype.require = function (id: string) {
  if (id === "server-only") return {};
  // eslint-disable-next-line prefer-rest-params
  return originalRequire.apply(this, arguments as never);
};

const {
  editDeadline,
  isEditable,
  msRemaining,
  formatRemaining,
  financialYear,
} = await import("../order-window.ts");

let pass = 0;
let fail = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  if (String(actual) === String(expected)) {
    pass++;
    console.log(`  OK   ${label} = ${actual}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}: got ${actual}, want ${expected}`);
  }
}

const HOUR = 60 * 60 * 1000;

console.log("edit deadline");
{
  const base = new Date("2026-07-22T10:00:00Z");
  eq(
    "24h later",
    editDeadline(base, 24).toISOString(),
    "2026-07-23T10:00:00.000Z",
  );
  eq(
    "48h later",
    editDeadline(base, 48).toISOString(),
    "2026-07-24T10:00:00.000Z",
  );
}

console.log("isEditable");
{
  const future = new Date(Date.now() + 5 * HOUR);
  const past = new Date(Date.now() - HOUR);

  eq(
    "CREATED + future deadline",
    isEditable({ status: "CREATED", editableUntil: future }),
    true,
  );
  eq(
    "CREATED + expired deadline",
    isEditable({ status: "CREATED", editableUntil: past }),
    false,
  );
  eq(
    "CREATED + no deadline",
    isEditable({ status: "CREATED", editableUntil: null }),
    false,
  );
  // Once placed, editing must be closed regardless of the timestamp.
  eq(
    "PLACED + future deadline",
    isEditable({ status: "PLACED", editableUntil: future }),
    false,
  );
  eq(
    "CANCELLED + future deadline",
    isEditable({ status: "CANCELLED", editableUntil: future }),
    false,
  );
  eq(
    "DRAFT + future deadline",
    isEditable({ status: "DRAFT", editableUntil: future }),
    false,
  );
}

console.log("msRemaining");
{
  eq("null deadline", msRemaining(null), 0);
  eq("past deadline clamps to 0", msRemaining(new Date(Date.now() - HOUR)), 0);
  const r = msRemaining(new Date(Date.now() + 2 * HOUR));
  eq("about 2h", r > 1.9 * HOUR && r <= 2 * HOUR, true);
}

console.log("formatRemaining");
{
  eq("expired", formatRemaining(0), "Window closed");
  eq("negative", formatRemaining(-5000), "Window closed");
  eq("90 minutes", formatRemaining(90 * 60 * 1000), "1h 30m left to edit");
  eq("45 minutes", formatRemaining(45 * 60 * 1000), "45m left to edit");
  eq("24 hours", formatRemaining(24 * HOUR), "24h 0m left to edit");
}

console.log("financial year (April to March)");
{
  eq("1 April 2026", financialYear(new Date("2026-04-01T00:00:00Z")), "2026-27");
  eq("31 March 2026", financialYear(new Date("2026-03-31T00:00:00Z")), "2025-26");
  eq("22 July 2026", financialYear(new Date("2026-07-22T00:00:00Z")), "2026-27");
  eq("1 Jan 2027", financialYear(new Date("2027-01-01T00:00:00Z")), "2026-27");
  eq("31 Dec 2026", financialYear(new Date("2026-12-31T00:00:00Z")), "2026-27");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
