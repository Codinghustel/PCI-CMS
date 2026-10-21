import { ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import {
  CONTENT_REVALIDATE_SECONDS,
  LOCKOUT_MINUTES,
  MAX_CRM_ATTEMPTS,
  MAX_DOCUMENT_MB,
  MAX_FAILED_LOGIN_ATTEMPTS,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_MB,
  MAX_LEAD_EXPORT_ROWS,
  MAX_PAGE_REVISIONS,
  PASSWORD_MIN_LENGTH,
  SESSION_ABSOLUTE_SECONDS,
  SESSION_IDLE_SECONDS,
} from "@/lib/limits";

// In-app user guide for the PCI-Orbit CMS (/admin/guide).
// Every statement describes current behaviour; numbers come from lib/limits so
// they always match what the system enforces. tests/unit/guide.test.ts checks
// links, permissions and button labels against the code — update both when the
// CMS changes. `permissions` lists the permissions a topic is about (any one
// is enough); topics without permissions apply to everyone.

const hours = (s: number) => `${s / 3600} hour${s === 3600 ? "" : "s"}`;
const minutes = (s: number) => `${Math.round(s / 60)} minutes`;

export type GuideIcon =
  | "start" | "roles" | "dashboard" | "workflow" | "pages" | "projects" | "commercial" | "updates"
  | "content" | "media" | "navigation" | "theme" | "settings" | "leads" | "applications" | "users"
  | "audit" | "quality" | "help";

export interface GuideSection {
  id: string;
  title: string;
  icon: GuideIcon;
  group: "Basics" | "Content" | "Website" | "Leads & people" | "Help";
  permissions?: Permission[];
  /** Where to find it in the CMS. */
  where?: string;
  summary: string;
  steps?: { title: string; items: string[] };
  terms?: { term: string; text: string }[];
  tips?: string[];
  /** Shortcut links; `permission` is what the linked screen requires (checked by tests). */
  links?: { href: string; label: string; permission?: Permission }[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "getting-started",
    title: "Signing in & your account",
    icon: "start",
    group: "Basics",
    where: "/admin/login · your name at the bottom of the left menu",
    summary:
      "The CMS (PCI-Orbit) is where PCI's team manages the website: projects, construction updates, pages, news, media and the enquiries that come in from the site.",
    steps: {
      title: "Getting started",
      items: [
        "Go to /admin and sign in with the email address and password your administrator gave you.",
        `Click your name at the bottom of the left menu to open My account, and change your password. Use at least ${PASSWORD_MIN_LENGTH} characters with upper- and lower-case letters and at least one number.`,
        "The left menu only shows the areas your role can use. If something you need is missing, ask an administrator.",
        "Use Sign out (bottom of the left menu) when you finish, especially on shared computers.",
      ],
    },
    tips: [
      `You are signed out after ${hours(SESSION_IDLE_SECONDS)} without activity, and after ${hours(SESSION_ABSOLUTE_SECONDS)} in any case. Unsaved changes are lost, so save regularly.`,
      `After ${MAX_FAILED_LOGIN_ATTEMPTS} wrong passwords in a row the account is locked for ${LOCKOUT_MINUTES} minutes. An administrator can reset your password, which also unlocks the account.`,
      "Changing your password signs you out on every other device.",
      "Your email address cannot be changed; an administrator would create a new account.",
    ],
    links: [{ href: "/admin/account", label: "My account" }],
  },
  {
    id: "roles",
    title: "Roles: who can do what",
    icon: "roles",
    group: "Basics",
    summary:
      "Every user has one role. The role decides which screens you see and which buttons you can use. The defaults are below; administrators can adjust what each role (except Administrator) is allowed to do.",
    terms: [
      { term: ROLE_LABELS.ADMIN, text: "Everything, including users and roles, theme, settings, integrations and job applications." },
      { term: ROLE_LABELS.EDITOR, text: "Creates, edits, publishes, unpublishes and deletes all content; manages menus, redirects and media; views, exports and re-sends leads; reads the audit log." },
      { term: ROLE_LABELS.AUTHOR, text: "Creates content and edits their own drafts, then submits them for review. Cannot publish, and cannot edit an item once it is published. Can upload media." },
      { term: ROLE_LABELS.SALES_APPROVER, text: "Approves or rejects project prices, payment plans and handover dates; can view content and leads." },
      { term: ROLE_LABELS.VIEWER, text: "Read-only access to the dashboard, content, media and leads." },
    ],
    tips: ["Your role and your exact permissions are listed at the top of this guide. Topics you cannot act on are marked “Requires …”."],
  },
  {
    id: "dashboard",
    title: "The dashboard",
    icon: "dashboard",
    group: "Basics",
    permissions: ["dashboard.view"],
    where: "Dashboard (top of the left menu)",
    summary: "Your starting point: content totals, recently updated items, what is waiting for review and data-quality warnings.",
    terms: [
      { term: "Data quality", text: "Warns about published UAE projects without a DLD permit number, ongoing projects with no construction update or an old one, and approved commercial details that are getting old (limits set in Settings → Data quality)." },
      { term: "Awaiting review", text: "Pages, projects, construction updates and articles submitted for review, and project commercial details awaiting Sales approval. Click an item to open it." },
      { term: "Leads (30 days)", text: "New enquiries in the last 30 days, and how many could not be delivered to Bitrix24." },
    ],
    links: [{ href: "/admin", label: "Open the dashboard", permission: "dashboard.view" }],
  },
  {
    id: "workflow",
    title: "Drafts, review, publishing & preview",
    icon: "workflow",
    group: "Basics",
    permissions: ["content.read"],
    summary:
      "Pages, projects, construction updates, articles, locations and vacancies share one publishing workflow, controlled from the bar at the top of each editor. Nothing appears on the website until it is published.",
    terms: [
      { term: "Draft", text: "Work in progress, visible only in the CMS." },
      { term: "In review", text: "Submitted by an author; an editor/publisher should check and publish it." },
      { term: "Published", text: "Live on the website. On a published item the save button is called Update, and saved changes go live straight away." },
      { term: "Scheduled", text: `Published with a future date. It goes live automatically within about ${minutes(CONTENT_REVALIDATE_SECONDS)} of that time. Pages (Settings & SEO → Schedule publication) and news articles (Publication date) can be scheduled.` },
      { term: "Unpublished", text: "Taken off the website but kept in the CMS. Prefer this to deleting." },
    ],
    steps: {
      title: "Typical flow",
      items: [
        "Create the item and press Save draft as often as you like.",
        "Pages and projects have a Preview button in the top bar showing exactly how the draft will look on the website (previews are private). For other content, use View live once it is published.",
        "Authors press Submit for review. Editors/publishers press Publish.",
        "To take something offline press Unpublish. Delete is permanent; it is in the Settings & SEO tab for pages, the Compliance & SEO tab for projects, and at the bottom of the editor for other content.",
      ],
    },
    tips: [
      "Changing the URL of a published page or project automatically creates a redirect from the old address.",
      `Pages keep their last ${MAX_PAGE_REVISIONS} saved versions — open the History tab to restore one (the page keeps its current URL).`,
      "Authors can delete their own drafts that were never published; deleting anything else needs the “Delete content” permission.",
    ],
  },
  {
    id: "pages",
    title: "Pages & the page builder",
    icon: "pages",
    group: "Content",
    permissions: ["content.writeOwn", "content.write"],
    where: "Pages",
    summary:
      "Pages such as Home, About, Invest with PCI, Contact and campaign landing pages are built from ready-made blocks that follow the PCI brand automatically.",
    steps: {
      title: "Create a page",
      items: [
        "Pages → New page. Enter a title; the URL is suggested for you (use '/' for nested pages, e.g. about/leadership). Some URLs, such as projects or media, are reserved for built-in sections.",
        "Content tab: optionally fill in Introduction (shown in the page banner when the page does not start with a hero block).",
        "Press Add block and choose a block, for example Hero banner, Text, Image and text, Statistics, Image gallery, Video, Projects showcase, FAQs, Enquiry form or Pay My Installment.",
        "Fill in the block's fields. Use the arrows to reorder, the eye to hide, the copy icon to duplicate and the bin to remove a block.",
        "Settings & SEO tab: SEO title (up to 70 characters), meta description (120–160 characters is ideal), banner image, social sharing image, canonical URL and “Hide from search engines”. Publishers can also schedule publication here.",
        "Press Preview, then Publish (or Submit for review).",
      ],
    },
    tips: [
      "The homepage is the page with the URL “home”; its URL cannot be changed and it cannot be deleted.",
      "Blocks that show projects, construction updates, news, VR tours, locations or vacancies fill themselves from published content; for projects you can also hand-pick which ones to show.",
      "A block with a problem is marked “Needs attention” and the message names the field to fix.",
      "Use Duplicate (top bar) to start a new page from an existing one; the copy is a draft.",
      "Statistics must be real, verified figures — never placeholders.",
    ],
    links: [{ href: "/admin/pages", label: "Go to Pages", permission: "content.read" }],
  },
  {
    id: "projects",
    title: "Projects",
    icon: "projects",
    group: "Content",
    permissions: ["content.writeOwn", "content.write"],
    where: "Projects",
    summary:
      "Each project is one structured record: basics, story, facts, media, floor plans, documents, VR tours, commercial details, compliance and SEO. The project page on the website is built from these fields.",
    steps: {
      title: "Add a project",
      items: [
        "Projects → New project. Enter the name, category, construction status, country/market and city, then press Create project.",
        "Basics tab: URL slug, address, location page, latitude/longitude (for an exact map pin), “Feature on the homepage” and sort order (lower numbers first).",
        "Content tab: tagline, overview, key facts, units/spaces, amenities, location & connectivity, and optional related projects.",
        "Media tab: hero image (required to publish), card image, hero film and project films (YouTube links), and the gallery.",
        "Floor plans & downloads tab: plan images or PDFs and brochures/documents. Switch on “Require an enquiry form…” to ask visitors for their details before they can view or download.",
        "VR tours tab: paste the https embed URL from the VR provider. The VR section only appears on the website when at least one tour is active.",
        "Commercial tab: price, currency, handover and payment plan — see “Prices, payment plans & Sales approval”.",
        "Compliance & SEO tab: DLD permit number and QR code (UAE), approvals/NOC references (Pakistan), Bitrix24 project identifier, SEO title and description.",
        "Save draft, Preview, then Publish (or Submit for review).",
      ],
    },
    terms: [
      { term: "Publish checklist", text: "A project needs a city, category, construction status, hero image and an overview of at least a few sentences before it can be published. The yellow box lists what is missing (based on the last save)." },
      { term: "UAE projects", text: "Cannot be published without the DLD advertising permit number and the permit QR code image." },
    ],
    tips: [
      "Use Duplicate (top bar) to start a similar project quickly; the copy starts as a draft and is not featured.",
      "Construction updates are added separately; the update with the most recent date appears on the project page automatically.",
    ],
    links: [{ href: "/admin/projects", label: "Go to Projects", permission: "content.read" }],
  },
  {
    id: "commercial",
    title: "Prices, payment plans & Sales approval",
    icon: "commercial",
    group: "Content",
    permissions: ["projects.approveCommercial", "content.write", "content.writeOwn"],
    where: "Projects → (project) → Commercial tab",
    summary:
      "Starting price, currency, handover, payment plan headline and payment plan steps are commercial details. They appear on the website only after a Sales Approver approves them, together with the approval date (“as of”).",
    steps: {
      title: "How approval works",
      items: [
        "An editor enters or changes the details in the project's Commercial tab and saves. The approval status becomes “Awaiting approval”.",
        "A Sales Approver opens the project (the dashboard lists pending approvals), checks the figures, optionally adds a review note and presses Approve or Reject.",
        "Once approved, the details appear on the website with the approval date. Any later change to them returns the status to “Awaiting approval” and hides them again until re-approved.",
      ],
    },
    tips: [
      "If you were the last person to save the project, another approver must approve it (administrators excepted).",
      "Rejected details stay hidden from the website; the reviewer's note is shown in the Commercial tab.",
      "Use the “Show … on the website” switches to hide the price, handover date or payment plan for a project even when approved.",
      "Payment plan percentages cannot add up to more than 100%, and a price needs a currency.",
    ],
  },
  {
    id: "updates",
    title: "Construction updates",
    icon: "updates",
    group: "Content",
    permissions: ["content.writeOwn", "content.write"],
    where: "Construction updates",
    summary: "Dated progress reports linked to a project. They build each project's construction history and the Project Updates page.",
    steps: {
      title: "Post an update",
      items: [
        "Construction updates → New update (or Add update in a project's Media tab, which pre-selects the project).",
        "Choose the project, then enter the title, URL slug and update date (required, YYYY-MM-DD).",
        "Add progress % (0–100), milestone, summary, details, photos with captions and, if available, a YouTube video.",
        "Publish (or Submit for review). The project page always shows the published update with the most recent date; older updates stay in the archive.",
      ],
    },
    tips: ["Post regularly for projects under construction — the dashboard flags ongoing projects whose latest update is older than the limit in Settings → Data quality."],
    links: [{ href: "/admin/updates", label: "Go to Construction updates", permission: "content.read" }],
  },
  {
    id: "other-content",
    title: "News, locations, careers & FAQs",
    icon: "content",
    group: "Content",
    permissions: ["content.writeOwn", "content.write"],
    summary: "These content types use the same editor style and publishing workflow (FAQs simply have a Published switch).",
    terms: [
      { term: "News & media", text: "News, press releases, events (with event date and location) and insights, with cover image and optional video. Authors can create articles; set a future publication date (YYYY-MM-DD HH:mm, in UTC) and press Publish to schedule one." },
      { term: "Locations", text: "Areas such as DHA Phase 1 or Al Barari: overview, hero image, map centre (latitude/longitude) and landmarks. Projects linked to a location (project Basics tab) appear on its page and map. Requires “Edit all content”." },
      { term: "Careers", text: "Vacancies with an optional closing date; applications with CVs arrive under Job applications. The “Life at PCI” text is the Careers page in Pages. Requires “Edit all content”." },
      { term: "FAQs", text: "Questions grouped by category (e.g. general, investment, payments). An FAQ block on a page shows the published FAQs of the category you choose. Requires “Edit all content”." },
    ],
    links: [
      { href: "/admin/articles", label: "News & media", permission: "content.read" },
      { href: "/admin/locations", label: "Locations", permission: "content.read" },
      { href: "/admin/vacancies", label: "Careers", permission: "content.read" },
      { href: "/admin/faqs", label: "FAQs", permission: "content.read" },
    ],
  },
  {
    id: "media",
    title: "Media library",
    icon: "media",
    group: "Content",
    permissions: ["media.read", "media.upload"],
    where: "Media library",
    summary: `All images and documents used on the website. Images are optimised automatically and resized to at most ${MAX_IMAGE_DIMENSION} px.`,
    steps: {
      title: "Upload and manage files",
      items: [
        "Write the alt text first — a short description of the image for people using screen readers. Images cannot be uploaded without it.",
        `Upload JPG, PNG, WebP, AVIF or GIF images (up to ${MAX_IMAGE_MB} MB) or PDF documents (up to ${MAX_DOCUMENT_MB} MB). Other file types, including SVG, are refused for security.`,
        "Click a file to edit its alt text, title and tags, copy its link, or Replace file. The replacement must be the same file type, and the file keeps the same address, so links to a brochure keep working.",
      ],
    },
    tips: [
      "Files still used by content cannot be deleted — the message says where they are used; remove them from that content first.",
      "You can also upload directly from any image or document field: Choose → Upload.",
      "Files marked “No alt text” in the library should be given a description.",
    ],
    links: [{ href: "/admin/media", label: "Go to Media library", permission: "media.read" }],
  },
  {
    id: "navigation",
    title: "Menus & redirects",
    icon: "navigation",
    group: "Website",
    permissions: ["navigation.manage", "redirects.manage"],
    where: "Menus · Redirects",
    summary: "Control the website's navigation and keep old links working.",
    terms: [
      { term: "Menus", text: "Main navigation (with one level of dropdown links), footer links and legal links. A link can be a path such as /projects, a full https address, or a mailto:/tel: link. Press Save menu for each menu." },
      { term: "Redirects", text: "Send visitors and search engines from an old address to a new one. Use Permanent (301) for pages that have moved for good. A redirect takes priority over any page at the same address, so remove it if you later publish new content there. Changes apply within about 15 seconds." },
    ],
    tips: ["Redirects to themselves or that would bounce back and forth are refused, and system addresses (/admin, /api) cannot be redirected."],
    links: [{ href: "/admin/navigation", label: "Menus", permission: "navigation.manage" }, { href: "/admin/redirects", label: "Redirects", permission: "redirects.manage" }],
  },
  {
    id: "theme",
    title: "Theme & branding",
    icon: "theme",
    group: "Website",
    permissions: ["theme.manage"],
    where: "Theme & branding",
    summary: "Change the website's colours, fonts and button styles without code. The CMS itself keeps its own look.",
    steps: {
      title: "Change the theme safely",
      items: [
        "Adjust colours with the pickers or type hex values (e.g. #1F3C59), then choose heading and body fonts, heading style, button shape, button text and corner radius.",
        "Check the live preview and the accessibility panel — it warns when a colour pair would be hard to read.",
        "Press Publish theme to apply it to the website. Discard changes restores the published theme; Reset to PCI defaults loads the original PCI theme into the editor (press Publish theme to apply it).",
      ],
    },
    links: [{ href: "/admin/theme", label: "Theme & branding", permission: "theme.manage" }],
  },
  {
    id: "settings",
    title: "Settings & integrations",
    icon: "settings",
    group: "Website",
    permissions: ["settings.manage"],
    where: "Settings",
    summary: "Site-wide information and connections to other systems, organised in tabs. Press Save settings once to save every tab.",
    terms: [
      { term: "General", text: "Site name, tagline, logos for light and dark backgrounds, footer introduction and copyright line." },
      { term: "Contact & offices", text: "Main phone (Call buttons), WhatsApp number and pre-filled message (WhatsApp buttons use the main phone if no WhatsApp number is set), email and offices with a map search text." },
      { term: "Social links", text: "Facebook, Instagram, LinkedIn, YouTube, X and TikTok addresses shown in the footer." },
      { term: "SEO defaults", text: "Default page title, title suffix, meta description and social sharing image used when a page has none." },
      { term: "Analytics & consent", text: "Google Tag Manager container ID (GTM-XXXXXXX) and cookie banner text. Tags load only after a visitor accepts cookies." },
      { term: "Forms & CRM", text: "The consent statement and success message shown on every enquiry form." },
      { term: "Pay My Installment", text: "Show/hide the payment buttons, button label, entry page heading, introduction and security note." },
      { term: "Project finder", text: "Turn the Project Finder assistant on or off and edit its title, greeting and disclaimer." },
      { term: "Data quality", text: "How many days before the dashboard warns about old commercial details and old construction updates." },
      { term: "Integrations", text: "Status of Bitrix24, the scheduled job, the payment service, search indexing and analytics; Bitrix24 options (delivery on/off, project field, responsible user, source label); Test connection and Deliver pending leads now (these two act immediately)." },
    ],
    tips: ["Secret keys and webhook addresses are managed by IT in the hosting environment and are never shown in full here."],
    links: [{ href: "/admin/settings", label: "Settings", permission: "settings.manage" }, { href: "/admin/settings?tab=integrations", label: "Integrations", permission: "settings.manage" }],
  },
  {
    id: "leads",
    title: "Leads & Bitrix24",
    icon: "leads",
    group: "Leads & people",
    permissions: ["leads.read"],
    where: "Leads",
    summary:
      "Every enquiry from the website (contact, project enquiry, brochure request, investor, channel partner, payment request and Project Finder) is saved in the CMS first and then sent to Bitrix24, so no lead is lost if the CRM is unavailable.",
    terms: [
      { term: "Delivered", text: "Created in Bitrix24; the Bitrix24 lead number is shown on the lead." },
      { term: "Pending", text: "Waiting to be sent (normally only for a few seconds)." },
      { term: "Failed", text: `Bitrix24 did not accept it. Temporary problems are retried automatically up to ${MAX_CRM_ATTEMPTS} times when the scheduled job is set up (see Settings → Integrations); other errors need a manual re-send. The error and every attempt are shown on the lead.` },
      { term: "CRM not configured", text: "Bitrix24 is not connected, or delivery is turned off in Settings → Integrations. The lead is kept and delivered by the scheduled job or Deliver pending leads now once delivery is enabled." },
    ],
    steps: {
      title: "Working with leads",
      items: [
        "Search by name, email, phone or project, and filter by Form and CRM status.",
        "Open a lead to see the contact details, project, page, campaign (UTM) information, consent and delivery attempts.",
        "Re-send to Bitrix24 retries a lead that was not delivered; it checks Bitrix24 first so the lead is not created twice.",
        `Export CSV downloads the current filtered list (up to ${MAX_LEAD_EXPORT_ROWS.toLocaleString("en-GB")} rows) if your role allows exports.`,
      ],
    },
    tips: ["Leads are personal data: export only when needed, store files securely and delete them when no longer needed."],
    links: [{ href: "/admin/leads", label: "Go to Leads", permission: "leads.read" }],
  },
  {
    id: "applications",
    title: "Job applications",
    icon: "applications",
    group: "Leads & people",
    permissions: ["applications.read"],
    where: "Job applications",
    summary: "Applications submitted from vacancy pages, with the applicant's CV (PDF) and cover note.",
    tips: ["CVs are private files; every download is recorded in the audit log.", "Share applications with HR through PCI's approved channels only."],
    links: [{ href: "/admin/applications", label: "Job applications", permission: "applications.read" }],
  },
  {
    id: "users",
    title: "Users, roles & permissions",
    icon: "users",
    group: "Leads & people",
    permissions: ["users.manage"],
    where: "Users · Roles & permissions",
    summary: "Administrators create accounts, assign roles and decide what each role can do.",
    steps: {
      title: "Manage access",
      items: [
        "Users → New user: name, email, role and an initial password (share it securely and ask the person to change it after signing in).",
        "Use the pencil to change the name or role or to deactivate an account, the key to reset a password and the bin to delete. Changing a role, deactivating or resetting a password signs the person out everywhere immediately.",
        "Roles & permissions: choose a role card, switch individual permissions on or off and press Save changes. Every permission is explained, Reset to defaults restores a role, and Compare roles shows all roles side by side. Changes apply to signed-in users immediately.",
      ],
    },
    tips: [
      "The CMS always keeps at least one active administrator, and you cannot change your own role or deactivate yourself.",
      "Administrators always have every permission, and “Manage users & roles” can only belong to administrators.",
      "Prefer deactivating to deleting so the audit history stays readable.",
    ],
    links: [{ href: "/admin/users", label: "Users", permission: "users.manage" }, { href: "/admin/roles", label: "Roles & permissions", permission: "users.manage" }],
  },
  {
    id: "audit",
    title: "Audit log",
    icon: "audit",
    group: "Leads & people",
    permissions: ["audit.read"],
    where: "Audit log",
    summary: "A record of who did what and when: sign-ins and lockouts, content changes and publishing, approvals, menus, redirects, media, theme, settings and integration actions, users and roles, lead exports and re-sends, and CV downloads.",
    links: [{ href: "/admin/audit", label: "Audit log", permission: "audit.read" }],
  },
  {
    id: "good-practice",
    title: "Good practice",
    icon: "quality",
    group: "Help",
    summary: "A few habits keep the website accurate, compliant and fast.",
    tips: [
      "Never publish unapproved prices, availability or investment returns — use the Sales approval workflow.",
      "Give every image meaningful alt text; avoid text baked into images.",
      "Keep construction updates current and dated.",
      "Write unique SEO titles and descriptions for important pages and projects.",
      "Preview before publishing and check the page on a phone.",
      "Unpublish rather than delete, and add a redirect when you retire a page.",
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting & FAQs",
    icon: "help",
    group: "Help",
    summary: "Quick answers to the most common questions.",
    terms: [
      { term: "A menu item or button is missing", text: "Your role does not include that permission (see your permissions at the top of this guide). Ask an administrator." },
      { term: "There is no Publish button", text: "Authors submit for review instead; an editor/publisher publishes. Authors also cannot edit an item once it is published." },
      { term: "My change is not on the website", text: `Check that the item is Published (not Draft, In review, Unpublished or Scheduled) and reload the page. Scheduled items go live within about ${minutes(CONTENT_REVALIDATE_SECONDS)} of their date. Prices only show once approved.` },
      { term: "A UAE project will not publish", text: "Add the DLD permit number and the QR code image in the Compliance & SEO tab, then save." },
      { term: "Prices are not showing", text: "They are awaiting Sales approval or were rejected, or the “Show … on the website” switch is off for that project." },
      { term: "I cannot delete an image", text: "It is still used; the message says where. Remove it from that content first." },
      { term: "A lead shows Failed", text: "Open it to see the error. Use Re-send to Bitrix24, and contact IT if it keeps failing." },
      { term: "I was signed out", text: `Sessions end after ${hours(SESSION_IDLE_SECONDS)} of inactivity (and always after ${hours(SESSION_ABSOLUTE_SECONDS)}). Save regularly.` },
      { term: "An old link shows a different page", text: "A redirect for that address exists. An editor can remove it under Redirects." },
    ],
  },
];

export const GUIDE_GROUPS = ["Basics", "Content", "Website", "Leads & people", "Help"] as const;
