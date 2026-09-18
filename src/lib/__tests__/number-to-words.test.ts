/**
 * Amount-in-words assertions. Run with: npm run test:words
 *
 * Dependency-free so it runs under tsx without a test runner, matching
 * pricing.test.ts.
 */
import { amountInWords, numberToWords } from "../number-to-words";

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

console.log("\nwhole numbers");
eq("0", numberToWords(0), "Zero");
eq("7", numberToWords(7), "Seven");
eq("13 (teen)", numberToWords(13), "Thirteen");
eq("20 (round ten)", numberToWords(20), "Twenty");
eq("45", numberToWords(45), "Forty Five");
eq("100", numberToWords(100), "One Hundred");
eq("999", numberToWords(999), "Nine Hundred Ninety Nine");

console.log("\nIndian grouping — thousand, lakh, crore");
eq("1000", numberToWords(1000), "One Thousand");
eq(
  "67666 (sample invoice)",
  numberToWords(67666),
  "Sixty Seven Thousand Six Hundred Sixty Six",
);
eq("1 lakh", numberToWords(100000), "One Lakh");
eq(
  "12,34,567",
  numberToWords(1234567),
  "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven",
);
eq("1 crore", numberToWords(10000000), "One Crore");
eq("25 crore", numberToWords(250000000), "Twenty Five Crore");

console.log("\ninvoice wording");
eq(
  "whole rupees",
  amountInWords(67666),
  "INR Sixty Seven Thousand Six Hundred Sixty Six Only",
);
eq(
  "with paise (sample total)",
  amountInWords(67666.87),
  "INR Sixty Seven Thousand Six Hundred Sixty Six and Eighty Seven paise Only",
);
eq(
  "with paise (sample tax)",
  amountInWords(10321.87),
  "INR Ten Thousand Three Hundred Twenty One and Eighty Seven paise Only",
);
eq("zero", amountInWords(0), "INR Zero Only");
eq("string input", amountInWords("500.50"), "INR Five Hundred and Fifty paise Only");

console.log("\nedge cases");
// Paise rounding must not leave "and Hundred paise".
eq("99.999 rounds up a rupee", amountInWords(99.999), "INR One Hundred Only");
eq("negative is not a valid amount", amountInWords(-5), "INR Zero Only");
eq("garbage input", amountInWords("abc"), "INR Zero Only");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
