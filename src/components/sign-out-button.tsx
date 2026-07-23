import { LogOut } from "lucide-react";
import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        title="Sign out"
        className="flex h-9 w-9 min-h-0 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive active:scale-90"
      >
        <LogOut className="h-4 w-4" />
        <span className="sr-only">Sign out</span>
      </button>
    </form>
  );
}
