import { ListToolbar, PageHeader, Pagination } from "@/components/admin/page-header";
import { UsersManager } from "./users-manager";
import { requirePermissionPage } from "@/lib/auth/session";
import { listUsers } from "@/server/services/users";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { ROLES, ROLE_LABELS } from "@/lib/auth/permissions";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("users.manage");
  const sp = await searchParams;
  const { items, total, page, pageSize } = await listUsers(actor, { q: sp.q, role: sp.role, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Users" description="CMS accounts and roles. At least one active administrator is always kept." />
      <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-background p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          Each user has one role ({ROLES.map((r) => ROLE_LABELS[r]).join(", ")}). What each role can do is explained — and can be customised — on the Roles &amp; permissions screen.
        </p>
        <Link href="/admin/roles" className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline">
          <KeyRound className="size-4" aria-hidden /> Roles &amp; permissions
        </Link>
      </div>
      <ListToolbar q={sp.q} placeholder="Search name or email" filters={[{ name: "role", label: "Role", value: sp.role, options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) }]} />
      <UsersManager
        currentUserId={actor.id}
        users={items.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, lockedUntil: u.lockedUntil?.toISOString() ?? null, createdAt: u.createdAt.toISOString() }))}
      />
      <Pagination page={page} pageSize={pageSize} total={total} params={{ q: sp.q, role: sp.role }} />
    </>
  );
}
