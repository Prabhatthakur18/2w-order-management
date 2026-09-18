/**
 * Indian-numbering amount in words, for the Proforma Invoice.
 *
 * Groups as crore / lakh / thousand / hundred — not million/billion. The PI
 * carries exact paise (there is no round-off row), so paise are spelled out
 * too when present.
 *
 *   67666      -> "INR Sixty Seven Thousand Six Hundred Sixty Six Only"
 *   67666.87   -> "INR Sixty Seven Thousand Six Hundred Sixty Six and Eighty Seven paise Only"
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

/** 0–99 in words. Returns "" for 0 so callers can skip empty groups. */
function twoDigits(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = ONES[n % 10];
  return ones ? `${tens} ${ones}` : tens;
}

/** 0–999 in words, as "X Hundred Y". */
function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`);
  const tail = twoDigits(rest);
  if (tail) parts.push(tail);
  return parts.join(" ");
}

/** Whole rupees in words, Indian grouping. */
export function numberToWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "Zero";
  const n = Math.floor(value);
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  // Crores above 99 keep grouping in Indian style (e.g. "One Hundred Crore").
  if (crore > 0) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest > 0) parts.push(threeDigits(rest));

  return parts.join(" ");
}

/**
 * Full invoice wording, e.g.
 * "INR Sixty Seven Thousand Six Hundred Sixty Six and Eighty Seven paise Only".
 */
export function amountInWords(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n) || n < 0) return "INR Zero Only";

  const rupees = Math.floor(n);
  // Round rather than truncate — 0.875 stored as a float must read as 88p.
  const paise = Math.round((n - rupees) * 100);

  // Rounding paise can tip into the next rupee (e.g. 99.999).
  if (paise === 100) {
    return `INR ${numberToWords(rupees + 1)} Only`;
  }

  const rupeeWords = numberToWords(rupees);
  if (paise === 0) return `INR ${rupeeWords} Only`;
  return `INR ${rupeeWords} and ${twoDigits(paise)} paise Only`;
}
