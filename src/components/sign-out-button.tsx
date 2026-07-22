import { LogOut } from "lucide-react";
import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
      className="w-full"
    >
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-all duration-300 hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive active:scale-95"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </form>
  );
}
