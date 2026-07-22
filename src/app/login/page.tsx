import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { AlertCircle } from "lucide-react";
import { auth, signIn } from "@/auth";
import { landingFor } from "@/lib/roles";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect(landingFor(session.user.roles ?? []));

  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      await signIn("credentials", { email, password, redirect: false });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/login?error=1");
      }
      throw err;
    }

    const s = await auth();
    redirect(landingFor(s?.user.roles ?? []));
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-app-wrapper px-4 py-10">
      <div
        className="glow-blob -top-20 -left-20 h-80 w-80 bg-primary/30"
        aria-hidden
      />
      <div
        className="glow-blob -bottom-24 -right-16 h-80 w-80 bg-brand-orange/25"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="text-gradient-premium text-3xl font-bold tracking-tight">
            2W Orders
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Dealer order management
          </p>
        </div>

        <form
          action={login}
          className="glass-card space-y-4 rounded-3xl p-6"
        >
          {error ? (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              Incorrect email or password.
            </p>
          ) : null}

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-11 w-full rounded-xl border border-input bg-background px-3 py-2 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11 w-full rounded-xl border border-input bg-background px-3 py-2 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <button
            type="submit"
            className="gradient-primary h-11 w-full rounded-xl font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:opacity-90 active:scale-[0.98]"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
