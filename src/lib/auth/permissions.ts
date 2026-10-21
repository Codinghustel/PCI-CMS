// Role-based access control. Pure module (no server imports) so the UI can use
// it to hide controls — but every server-side operation re-checks permissions;
// hiding a button is never the security boundary.
//
// Each role has built-in defaults (DEFAULT_ROLE_PERMISSIONS). Administrators can
// customise non-admin roles in the CMS (stored in RolePermission); the signed-in
// Actor then carries its effective permission list, resolved per request.

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
  ADMIN: "Full CMS administration including users and roles, theme, settings and integrations. Always has every permission.",
  EDITOR: "Creates, reviews and publishes all content; manages menus, redirects, SEO and media; works with leads.",
  AUTHOR: "Creates and edits their own drafts and submits them for review. Cannot publish.",
  SALES_APPROVER: "Approves commercial project details (price, payment plan, handover) and views leads.",
  VIEWER: "Read-only access to the dashboard, content and leads.",
};

export const PERMISSION_GROUPS = ["Overview", "Content", "Projects", "Media", "Website", "Leads & HR", "Administration"] as const;
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export const PERMISSION_INFO = {
  "dashboard.view": { group: "Overview", label: "View dashboard", description: "Open the CMS dashboard with content statistics, review queue and data-quality warnings." },
  "content.read": { group: "Content", label: "View content", description: "Browse pages, projects, updates, articles, locations, vacancies and FAQs in the CMS (read-only)." },
  "content.writeOwn": { group: "Content", label: "Create & edit own drafts", description: "Create new content and edit their own unpublished drafts, then submit them for review." },
  "content.write": { group: "Content", label: "Edit all content", description: "Edit any content item, including items created by others and published items." },
  "content.publish": { group: "Content", label: "Publish & unpublish", description: "Make content live on the website, schedule it, or take it offline." },
  "content.delete": { group: "Content", label: "Delete content", description: "Permanently delete pages, projects, updates and other content." },
  "projects.approveCommercial": { group: "Projects", label: "Approve commercial details", description: "Approve or reject project prices, payment plans and handover dates before they appear publicly." },
  "media.read": { group: "Media", label: "View media library", description: "Browse images and documents and pick them for content." },
  "media.upload": { group: "Media", label: "Upload & edit media", description: "Upload files, edit alt text and tags, and replace documents." },
  "media.delete": { group: "Media", label: "Delete media", description: "Delete files that are no longer used by any content." },
  "navigation.manage": { group: "Website", label: "Manage menus", description: "Edit the header, footer and legal navigation menus." },
  "redirects.manage": { group: "Website", label: "Manage redirects", description: "Create and remove 301/302 redirects for moved URLs." },
  "theme.manage": { group: "Website", label: "Manage theme & branding", description: "Change website colours, fonts and button styles." },
  "settings.manage": { group: "Website", label: "Manage settings & integrations", description: "Edit site settings, contact details, SEO defaults, analytics and integration options." },
  "leads.read": { group: "Leads & HR", label: "View leads", description: "See website enquiries and their CRM delivery status (personal data)." },
  "leads.export": { group: "Leads & HR", label: "Export leads", description: "Download leads as CSV. Exports contain personal data." },
  "leads.resend": { group: "Leads & HR", label: "Re-send leads to CRM", description: "Manually retry delivery of failed leads to Bitrix24." },
  "applications.read": { group: "Leads & HR", label: "View job applications", description: "See applicants and download CVs (personal data; downloads are audited)." },
  "users.manage": { group: "Administration", label: "Manage users & roles", description: "Create users, assign roles and customise role permissions. Administrators only." },
  "audit.read": { group: "Administration", label: "View audit log", description: "See who changed what and when." },
} as const satisfies Record<string, { group: PermissionGroup; label: string; description: string }>;

export type Permission = keyof typeof PERMISSION_INFO;
export const PERMISSIONS = Object.keys(PERMISSION_INFO) as Permission[];

/** Permissions that can never be granted to non-admin roles (prevents privilege escalation). */
export const ADMIN_ONLY_PERMISSIONS: readonly Permission[] = ["users.manage"];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
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
  /** Effective permissions resolved from the database; defaults apply when absent. */
  permissions?: readonly Permission[];
}

export function isPermission(value: string): value is Permission {
  return value in PERMISSION_INFO;
}

/** Cleans a permission list for a role: known values only, admin-only ones removed. */
export function sanitizeRolePermissions(role: RoleName, list: readonly string[]): Permission[] {
  if (role === "ADMIN") return [...PERMISSIONS];
  const set = new Set(list.filter(isPermission).filter((p) => !ADMIN_ONLY_PERMISSIONS.includes(p)));
  return PERMISSIONS.filter((p) => set.has(p));
}

export function permissionsFor(role: RoleName, custom?: readonly Permission[] | null): ReadonlySet<Permission> {
  if (role === "ADMIN") return new Set(PERMISSIONS);
  return new Set(custom ?? DEFAULT_ROLE_PERMISSIONS[role] ?? []);
}

export function can(actor: Pick<Actor, "role" | "permissions"> | null | undefined, permission: Permission): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  if (ADMIN_ONLY_PERMISSIONS.includes(permission)) return false;
  return (actor.permissions ?? DEFAULT_ROLE_PERMISSIONS[actor.role] ?? []).includes(permission);
}

/**
 * Whether the actor may edit a specific content item. Users with
 * content.write can edit anything; with only content.writeOwn, just their own
 * items that are not yet published.
 */
export function canEditItem(
  actor: Pick<Actor, "role" | "id" | "permissions"> | null | undefined,
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
