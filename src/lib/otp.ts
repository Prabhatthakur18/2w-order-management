import "server-only";
import { db } from "@/lib/db";

/**
 * Login OTP — a second factor after the password check succeeds.
 *
 * Delivery is a stub: the code is written to the server console instead of
 * actually sent by email/WhatsApp, since no provider is chosen yet (same
 * situation as the GST lookup in src/lib/gst-lookup.ts). Swapping in a real
 * provider means rewriting only sendOtp's delivery step below — the schema,
 * hashing, expiry and attempt-limiting all stay as they are.
 *
 * Uses the Web Crypto API (globalThis.crypto), not node:crypto — this module
 * is reachable from src/auth.ts, which Next.js's middleware bundles for the
 * Edge runtime, and node:crypto is not available there.
 */

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  const max = 10 ** OTP_LENGTH;
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const n = bytes[0] % max;
  return n.toString().padStart(OTP_LENGTH, "0");
}

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type OtpChannel = "EMAIL" | "WHATSAPP";

/**
 * Issues a fresh OTP for the user and "sends" it (logs it — see above).
 * Any earlier unconsumed codes for this user are left to expire naturally;
 * only the most recent one is checked on verify.
 */
export async function sendOtp(
  userId: string,
  channel: OtpChannel,
  destination: string,
): Promise<{ otpId: string }> {
  const code = generateCode();
  const otp = await db.loginOtp.create({
    data: {
      userId,
      codeHash: await hashCode(code),
      channel,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
    },
  });

  // STUB: replace with a real email/WhatsApp send once a provider is chosen.
  console.log(
    `[OTP STUB] ${channel} to ${destination}: ${code} (expires in ${OTP_TTL_MINUTES}m)`,
  );

  return { otpId: otp.id };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: string };

/** Checks a submitted code against the given challenge, with attempt limiting. */
export async function verifyOtp(
  otpId: string,
  submittedCode: string,
): Promise<VerifyOtpResult> {
  const otp = await db.loginOtp.findUnique({ where: { id: otpId } });
  if (!otp) return { ok: false, error: "That code has expired. Request a new one." };

  if (otp.consumedAt) {
    return { ok: false, error: "That code has already been used." };
  }
  if (otp.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "That code has expired. Request a new one." };
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  const matches = (await hashCode(submittedCode.trim())) === otp.codeHash;

  if (!matches) {
    await db.loginOtp.update({
      where: { id: otpId },
      data: { attempts: { increment: 1 } },
    });
    const remaining = MAX_ATTEMPTS - otp.attempts - 1;
    return {
      ok: false,
      error:
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
          : "Too many attempts. Request a new code.",
    };
  }

  await db.loginOtp.update({
    where: { id: otpId },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
