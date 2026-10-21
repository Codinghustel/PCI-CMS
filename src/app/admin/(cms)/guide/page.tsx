import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { GuideBrowser } from "./guide-browser";
import { requireActorPage } from "@/lib/auth/session";
import { rolePermissions } from "@/server/services/roles";
import { GUIDE_SECTIONS } from "@/lib/guide";
import { can, PERMISSION_INFO, PERMISSIONS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "User guide" };

/** How to use the CMS — available to every signed-in user, tailored to their role. */
export default async function GuidePage() {
  const actor = await requireActorPage();
  const perRole = await Promise.all(ROLES.map(async (role) => ({ role, permissions: await rolePermissions(role) })));

  const sections = GUIDE_SECTIONS.map((s) => ({
    ...s,
    available: !s.permissions || s.permissions.some((p) => can(actor, p)),
    // Only offer shortcuts to screens this user can actually open.
    links: s.links?.filter((l) => !l.permission || can(actor, l.permission)),
    // Roles that can act on this topic (with the current, possibly customised, permissions).
    roles: s.permissions
      ? perRole.filter((r) => s.permissions!.some((p) => can({ role: r.role, permissions: r.permissions }, p))).map((r) => ROLE_LABELS[r.role])
      : [],
  }));

  return (
    <>
      <PageHeader
        title="User guide"
        description="How to use the PCI-Orbit CMS to manage the website, projects and enquiries. Topics are marked according to what your role can do."
      />
      <GuideBrowser
        sections={sections}
        you={{
          name: actor.name,
          role: ROLE_LABELS[actor.role],
          roleDescription: ROLE_DESCRIPTIONS[actor.role],
          permissions: PERMISSIONS.filter((p) => can(actor, p)).map((p) => ({ group: PERMISSION_INFO[p].group, label: PERMISSION_INFO[p].label })),
        }}
      />
    </>
  );
}
