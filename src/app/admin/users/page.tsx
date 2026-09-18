import { requireRole } from "@/lib/guard";
import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/dashboard";
import { EmptyState } from "@/components/ui";
import { Users } from "lucide-react";
import { ROLE_META } from "@/lib/roles";
import { CreateUserForm } from "./create-user-form";
import { UserRow } from "./user-row";

export default async function UsersPage() {
  const session = await requireRole(["ADMIN"]);

  const users = await db.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { roles: true },
  });

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`${users.length} user${users.length === 1 ? "" : "s"}`}
      />

      <Section title="Add user">
        <CreateUserForm />
      </Section>

      <Section title="All users">
        {users.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No users yet"
            description="Add the first user above."
          />
        ) : (
          <div className="space-y-2.5">
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={{
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  phone: u.phone,
                  isActive: u.isActive,
                  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
                  createdAt: u.createdAt.toISOString(),
                  roles: u.roles.map((r) => ({
                    role: r.role,
                    label: ROLE_META[r.role].label,
                  })),
                }}
                isSelf={u.id === session.user.id}
              />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
