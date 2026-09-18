"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, TriangleAlert, UserPlus } from "lucide-react";
import type { Role } from "@prisma/client";
import { Button, Card, Field, Input } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { createUser } from "./actions";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "ASM", label: "ASM" },
  { value: "ADMIN", label: "Admin" },
  { value: "PLANT_OPS", label: "Plant Ops" },
  { value: "ACCOUNTS", label: "Accounts" },
  { value: "DISPATCH", label: "Dispatch" },
];

export function CreateUserForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("ASM");
  const [password, setPassword] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    setFieldErrors({});
    setSuccess(null);
    startSubmit(async () => {
      const result = await createUser({ name, email, phone, role, password });
      if (result.ok) {
        setSuccess(`${name} can now log in with ${email}.`);
        setName("");
        setEmail("");
        setPhone("");
        setPassword("");
        setRole("ASM");
        router.refresh();
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  const canSubmit = name.trim() && email.trim() && password.length >= 6;

  return (
    <Card>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" htmlFor="u-name" required error={fieldErrors.name}>
            <Input
              id="u-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Role" htmlFor="u-role" required>
            <Combobox
              options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
              value={role}
              onChange={(v) => setRole(v as Role)}
              placeholder="Select role"
              searchPlaceholder="Search roles…"
            />
          </Field>
        </div>

        <Field label="Email" htmlFor="u-email" required error={fieldErrors.email}>
          <Input
            id="u-email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" htmlFor="u-phone">
            <Input
              id="u-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field
            label="Password"
            htmlFor="u-password"
            required
            error={fieldErrors.password}
            hint="At least 6 characters."
          >
            <Input
              id="u-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </div>

        {error ? (
          <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-xs font-medium text-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {success}
          </p>
        ) : null}

        <Button
          className="w-full"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Create user
        </Button>
      </div>
    </Card>
  );
}
