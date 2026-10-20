import { ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { UsersManager } from "./users-manager";
import { requirePermissionPage } from "@/lib/auth/session";
import { listUsers } from "@/server/services/users";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("users.manage");
  const sp = await searchParams;
  const { items, total, page, pageSize } = await listUsers(actor, { q: sp.q, role: sp.role, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Users" description="CMS accounts and roles. At least one active administrator is always kept." />
      <details className="mb-4 rounded-lg border bg-background p-4 text-sm">
        <summary className="cursor-pointer font-medium">Role permissions</summary>
        <dl className="mt-3 grid gap-2 md:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r}><dt className="font-medium">{ROLE_LABELS[r]}</dt><dd className="text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd></div>
          ))}
        </dl>
      </details>
      <ListToolbar q={sp.q} placeholder="Search name or email" filters={[{ name: "role", label: "Role", value: sp.role, options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) }]} />
      <UsersManager
        currentUserId={actor.id}
        users={items.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, lockedUntil: u.lockedUntil?.toISOString() ?? null, createdAt: u.createdAt.toISOString() }))}
      />
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q, role: sp.role }} />
    </>
  );
}
