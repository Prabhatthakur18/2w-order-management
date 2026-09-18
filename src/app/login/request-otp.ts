"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendOtp } from "@/lib/otp";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RequestOtpResult =
  | { ok: true; otpId: string; maskedDestination: string }
  | { ok: false; error: string };

/**
 * Step 1 of login: checks the password and, if correct, issues an OTP.
 * Deliberately does not create a session — that only happens once the OTP
 * is verified in the credentials provider (see src/auth.ts).
 */
export async function requestLoginOtp(
  raw: unknown,
): Promise<RequestOtpResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email and password." };
  }
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Same message whether the account doesn't exist or the password is
  // wrong — the login form must not reveal which one it was.
  const invalidMessage = "Incorrect email or password.";

  if (!user || !user.isActive) {
    return { ok: false, error: invalidMessage };
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return { ok: false, error: invalidMessage };
  }

  const destination = user.email;
  const { otpId } = await sendOtp(user.id, "EMAIL", destination);

  return { ok: true, otpId, maskedDestination: maskEmail(destination) };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}
