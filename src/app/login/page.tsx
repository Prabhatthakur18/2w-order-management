import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { landingFor } from "@/lib/roles";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect(landingFor(session.user.roles ?? []));

  return (
    <main className="bg-grid relative flex min-h-dvh items-center justify-center overflow-hidden bg-app-wrapper px-4 py-10">
      <div
        className="glow-blob -top-20 -left-20 h-80 w-80 bg-primary/25"
        aria-hidden
      />
      <div
        className="glow-blob -bottom-24 -right-16 h-80 w-80 bg-brand-orange/20"
        aria-hidden
      />

      <div className="animate-rise relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span
            className="gradient-primary mb-4 flex h-14 w-14 items-center justify-center rounded-2xl font-display text-lg font-bold text-primary-foreground shadow-glow"
            aria-hidden
          >
            2W
          </span>
          <h1 className="font-display text-[2rem] font-semibold leading-none tracking-tight">
            Orders
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dealer order management
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
