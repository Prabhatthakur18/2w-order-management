"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { auth, signIn } from "@/auth";
import { landingFor } from "@/lib/roles";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  otpId: z.string().min(1),
  otpCode: z.string().min(1),
});

export type VerifyLoginOtpResult = { ok: false; error: string };

/**
 * Step 2 of login: verifies the OTP and, if correct, creates the real
 * session (redirects on success, so a true "ok" branch never returns).
 */
export async function verifyLoginOtp(
  raw: unknown,
): Promise<VerifyLoginOtpResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Enter the 6-digit code." };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Incorrect or expired code. Try again." };
    }
    throw err;
  }

  const session = await auth();
  redirect(landingFor(session?.user.roles ?? []));
}
