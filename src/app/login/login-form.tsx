"use client";

import { useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { requestLoginOtp } from "./request-otp";
import { verifyLoginOtp } from "./verify-otp";

/**
 * Two-step login: password, then a one-time code. Step 1 never creates a
 * session — only step 2's verify does, via the credentials provider in
 * src/auth.ts. See src/lib/otp.ts for why the code is logged, not sent.
 */
export function LoginForm() {
  const [step, setStep] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpId, setOtpId] = useState("");
  const [maskedDestination, setMaskedDestination] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitPassword(formData: FormData) {
    setError(null);
    const emailValue = String(formData.get("email") ?? "");
    const passwordValue = String(formData.get("password") ?? "");

    startTransition(async () => {
      const result = await requestLoginOtp({
        email: emailValue,
        password: passwordValue,
      });
      if (result.ok) {
        setEmail(emailValue);
        setPassword(passwordValue);
        setOtpId(result.otpId);
        setMaskedDestination(result.maskedDestination);
        setStep("otp");
      } else {
        setError(result.error);
      }
    });
  }

  function submitOtp(formData: FormData) {
    setError(null);
    const codeValue = String(formData.get("code") ?? "");

    startTransition(async () => {
      const result = await verifyLoginOtp({
        email,
        password,
        otpId,
        otpCode: codeValue,
      });
      if (!result.ok) {
        setError(result.error);
      }
      // On success, verifyLoginOtp redirects server-side — nothing to do here.
    });
  }

  return (
    <form
      action={step === "password" ? submitPassword : submitOtp}
      className="glass-card space-y-4 rounded-3xl p-6"
    >
      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {step === "password" ? (
        <>
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-bold uppercase tracking-[0.09em] text-muted-foreground"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={email}
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 shadow-xs outline-none transition-all duration-200 hover:border-primary/30 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-bold uppercase tracking-[0.09em] text-muted-foreground"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 shadow-xs outline-none transition-all duration-200 hover:border-primary/30 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="gradient-primary flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold text-primary-foreground shadow-glow transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setStep("password");
              setCode("");
              setError(null);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to{" "}
              <span className="font-semibold text-foreground">
                {maskedDestination}
              </span>
              .
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              (Dev mode: the code is printed to the server console, not
              actually sent.)
            </p>
          </div>

          <div>
            <label
              htmlFor="code"
              className="mb-1.5 block text-xs font-bold uppercase tracking-[0.09em] text-muted-foreground"
            >
              6-digit code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-center font-mono text-lg tracking-[0.5em] shadow-xs outline-none transition-all duration-200 hover:border-primary/30 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
            />
          </div>

          <button
            type="submit"
            disabled={pending || code.length !== 6}
            className="gradient-primary flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold text-primary-foreground shadow-glow transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </button>
        </>
      )}
    </form>
  );
}
