"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";

const ASSIGNABLE_ROLES: Role[] = [
  "ADMIN",
  "ASM",
  "PLANT_OPS",
  "ACCOUNTS",
  "DISPATCH",
];

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(20).optional().default(""),
  role: z.enum(["ADMIN", "ASM", "PLANT_OPS", "ACCOUNTS", "DISPATCH"]),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100),
});

export type CreateUserResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createUser(raw: unknown): Promise<CreateUserResult> {
  const session = await requireRole(["ADMIN"]);

  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  if (!ASSIGNABLE_ROLES.includes(input.role)) {
    return { ok: false, error: "Invalid role." };
  }

  const existing = await db.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "A user with that email already exists.",
      fieldErrors: { email: "Already in use" },
    };
  }

  try {
    const passwordHash = await bcrypt.hash(input.password, 10);

    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email.toLowerCase(),
          phone: input.phone || null,
          passwordHash,
        },
      });

      await tx.userRole.create({
        data: { userId: user.id, role: input.role },
      });

      await tx.auditLog.create({
        data: {
          entityType: "User",
          entityId: user.id,
          action: "CREATED",
          toValue: { email: user.email, role: input.role },
          actorId: session.user.id,
        },
      });

      return user;
    });

    revalidatePath("/admin/users");
    return { ok: true, userId: created.id };
  } catch (err) {
    console.error("createUser failed", err);
    return { ok: false, error: "Could not create the user. Try again." };
  }
}

export type ToggleActiveResult = { ok: true } | { ok: false; error: string };

export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<ToggleActiveResult> {
  const session = await requireRole(["ADMIN"]);

  const idParsed = z.string().min(1).max(64).safeParse(userId);
  if (!idParsed.success) return { ok: false, error: "Invalid user." };

  // An Admin must never be able to lock themselves out.
  if (idParsed.data === session.user.id && !isActive) {
    return { ok: false, error: "You cannot deactivate your own account." };
  }

  const user = await db.user.findUnique({ where: { id: idParsed.data } });
  if (!user) return { ok: false, error: "User not found." };

  await db.$transaction([
    db.user.update({
      where: { id: idParsed.data },
      data: { isActive },
    }),
    db.auditLog.create({
      data: {
        entityType: "User",
        entityId: idParsed.data,
        action: isActive ? "ACTIVATED" : "DEACTIVATED",
        actorId: session.user.id,
      },
    }),
  ]);

  revalidatePath("/admin/users");
  return { ok: true };
}
