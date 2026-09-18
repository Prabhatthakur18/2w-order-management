"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Phone, TriangleAlert } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { setUserActive } from "./actions";

type UserSummary = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { role: string; label: string }[];
};

export function UserRow({
  user,
  isSelf,
}: {
  user: UserSummary;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setUserActive(user.id, !user.isActive);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card
      className="rail"
      style={
        {
          "--rail-color": user.isActive
            ? "hsl(var(--success))"
            : "hsl(var(--muted-foreground))",
        } as React.CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{user.name}</p>
            {user.roles.map((r) => (
              <Badge key={r.role} tone="primary">
                {r.label}
              </Badge>
            ))}
            {!user.isActive ? <Badge tone="neutral">Inactive</Badge> : null}
          </div>

          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            {user.email}
          </p>
          {user.phone ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              {user.phone}
            </p>
          ) : null}

          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {user.lastLoginAt
              ? `Last login ${formatDate(user.lastLoginAt)}`
              : "Never logged in"}{" "}
            · Added {formatDate(user.createdAt)}
          </p>

          {error ? (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-destructive/10 p-2 text-xs font-medium text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>

        <Button
          size="sm"
          variant={user.isActive ? "danger" : "secondary"}
          disabled={pending || isSelf}
          onClick={toggle}
          title={isSelf ? "You cannot deactivate your own account" : undefined}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : user.isActive ? (
            "Deactivate"
          ) : (
            "Activate"
          )}
        </Button>
      </div>
    </Card>
  );
}
