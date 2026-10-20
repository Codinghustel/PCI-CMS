// Role-based access control. Pure module (no server imports) so the UI can use
// it to hide controls — but every server-side operation re-checks permissions;
// hiding a button is never the security boundary.

export const ROLES = ["ADMIN", "EDITOR", "AUTHOR", "SALES_APPROVER", "VIEWER"] as const;
export type RoleName = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleName, string> = {
  ADMIN: "Administrator",
  EDITOR: "Editor / Publisher",
  AUTHOR: "Author",
  SALES_APPROVER: "Sales Approver",
  VIEWER: "Viewer (Leads & Reports)",
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  ADMIN: "Full CMS administration including users, theme, settings and integrations.",
  EDITOR: "Creates, reviews and publishes all content; manages menus, redirects, SEO and media; views leads.",
  AUTHOR: "Creates and edits their own drafts and submits them for review. Cannot publish.",
  SALES_APPROVER: "Approves commercial project fields (price, payment plan, handover); views leads.",
  VIEWER: "Read-only access to the dashboard, content lists and leads.",
};

export const PERMISSIONS = [
  "dashboard.view",
  "content.read",
  "content.write",
  "content.writeOwn",
  "content.publish",
  "content.delete",
  "projects.approveCommercial",
  "media.read",
  "media.upload",
  "media.delete",
  "navigation.manage",
  "redirects.manage",
  "theme.manage",
  "settings.manage",
  "users.manage",
  "leads.read",
  "leads.export",
  "leads.resend",
  "applications.read",
  "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<RoleName, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  EDITOR: [
    "dashboard.view",
    "content.read",
    "content.write",
    "content.writeOwn",
    "content.publish",
    "content.delete",
    "media.read",
    "media.upload",
    "media.delete",
    "navigation.manage",
    "redirects.manage",
    "leads.read",
    "leads.export",
    "leads.resend",
    "audit.read",
  ],
  AUTHOR: ["dashboard.view", "content.read", "content.writeOwn", "media.read", "media.upload"],
  SALES_APPROVER: ["dashboard.view", "content.read", "projects.approveCommercial", "media.read", "leads.read"],
  VIEWER: ["dashboard.view", "content.read", "media.read", "leads.read"],
};

export interface Actor {
  id: string;
  role: RoleName;
  name: string;
  email: string;
}

export function permissionsFor(role: RoleName): ReadonlySet<Permission> {
  return new Set(MATRIX[role] ?? []);
}

export function can(actor: Pick<Actor, "role"> | null | undefined, permission: Permission): boolean {
  if (!actor) return false;
  return (MATRIX[actor.role] ?? []).includes(permission);
}

/**
 * Whether the actor may edit a specific content item. Editors/admins can edit
 * anything; authors only their own items that are not yet published.
 */
export function canEditItem(
  actor: Pick<Actor, "role" | "id"> | null | undefined,
  item: { authorId: string | null; status: string } | null
): boolean {
  if (!actor) return false;
  if (can(actor, "content.write")) return true;
  if (!can(actor, "content.writeOwn")) return false;
  if (!item) return true; // creating a new item
  return item.authorId === actor.id && item.status !== "PUBLISHED";
}

/** Roles an actor is allowed to assign. Only administrators manage roles. */
export function assignableRoles(actor: Pick<Actor, "role">): RoleName[] {
  return actor.role === "ADMIN" ? [...ROLES] : [];
}
