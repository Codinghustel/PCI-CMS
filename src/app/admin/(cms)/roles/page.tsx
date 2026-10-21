import { PageHeader } from "@/components/admin/page-header";
import { RolesManager } from "./roles-manager";
import { requirePermissionPage } from "@/lib/auth/session";
import { listRoles } from "@/server/services/roles";

export default async function RolesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermissionPage("users.manage");
  const [roles, sp] = await Promise.all([listRoles(actor), searchParams]);
  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="Each CMS user has one role. A role's permissions decide what its users can see and do. Changes apply to signed-in users immediately and are recorded in the audit log."
      />
      <RolesManager
        initialRole={roles.some((r) => r.role === sp.role) ? sp.role! : "EDITOR"}
        roles={roles.map((r) => ({ ...r, updatedAt: r.updatedAt?.toISOString() ?? null }))}
      />
    </>
  );
}
