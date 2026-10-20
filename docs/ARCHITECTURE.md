# PCI-Orbit — Architecture, decisions & status

## 1. Sources and how conflicts were resolved

| Source | Used for |
|---|---|
| `Assets/Implementation.md` | Technical brief that was implemented (stack, CMS, security, testing) |
| `Assets/PCI Website Requirements.docx` (v1.2) | Functional baseline (sitemap, pages, CMS, Bitrix24, payment) |
| `Assets/MASTER Prompt.md` (v2.0) | Business decisions taken after v1.2 (payments, compliance, roles, data ownership) |
| premierchoiceint.com (public REST API, read-only) | Seed content: projects, construction photos, offices, FAQs, posts, legal text |
| samanadevelopers.com | Visual reference only (layout rhythm, typography scale) — PCI's own palette is used |

**Conflicts (please confirm):**

- **Stack.** The master prompt specifies MERN/MongoDB and says any deviation (e.g. PostgreSQL) needs
  CIO approval. `Implementation.md` explicitly requires Next.js + PostgreSQL + Prisma, so that was built.
  **CIO sign-off on this deviation is still required** (master prompt §4.2).
- **Payment label/flow.** The master prompt overrides the requirements doc: the button is
  "Pay My Installment", no anonymous payment form, the website never handles card data or balances,
  and payment logic lives in a separate Payment Service (Track C). Implemented accordingly.
- **Discovery.** No site-wide property search/filter; category/status browsing plus a chatbot-style
  "Project Finder", per both documents.

The WordPress site was used **read-only** (anonymous GETs to its public REST API). The credentials
file `Assets/WordpressSite.md` was not opened or used.

## 2. Architecture

```
Browser ──► proxy.ts ──► Next.js App Router
             │  • /admin: JWT check + sliding renewal
             │  • public: CMS redirects (301/302) and real 404s via a 15 s routing index
             ▼
   (site)/… Server Components ──► server/public-data.ts ('use cache', tags) ──┐
   admin/… Server Components + Server Actions ──► server/services/* ──────────┼──► Prisma ──► PostgreSQL
   api/… Route Handlers ──────────────────────► server/services/* ──────────┘
                                                server/integrations/* ──► Bitrix24 · Payment Service · storage
```

- **Services are framework-agnostic** (no `next/*` imports): they take an `Actor`, enforce
  permissions, validate with Zod and run transactions. Server Actions/Route Handlers only
  authenticate, call a service and refresh caches — so a separate Express/Nest API could reuse them.
- **Field-definition engine** (`lib/fields.ts`): one declaration drives both the CMS form UI and the
  server Zod schema. Used by the page builder (22 block types in `lib/sections/registry.ts`),
  project lists, settings and editors.
- **Rendering & caching (Cache Components).** Public reads are `'use cache'` with tags and a
  `content` profile (5 min revalidate, so scheduled content goes live on time). Every CMS mutation
  calls `updateTag(...)` so edits — and unpublishing — are visible immediately. Published pages are
  prerendered at build; slug pages read `params` inside Suspense; the proxy guarantees correct HTTP
  statuses (soft-404s are avoided). CMS screens are per-request and never cached.
- **Theme.** Tokens in `ThemeSettings` (validated hex/enums) → CSS custom properties consumed by
  Tailwind/shadcn. Editor has colour pickers, font/shape options, WCAG contrast warnings and a live
  preview; publishing invalidates the `theme` tag.

## 3. Data model (Prisma, `prisma/schema.prisma`)

Users/Session/AuditLog/RateLimitBucket · Media · Page (+PageRevision, JSON sections) · Menu/MenuItem ·
Redirect · SiteSettings · ThemeSettings · Location · Project (+gallery, floor plans, documents, VR
tours, related) · ProjectUpdate (+images) · Article · Vacancy/JobApplication · Faq · Lead
(+CrmDeliveryAttempt). JSON columns hold only small ordered lists edited as a unit, always validated.

Key rules enforced in services: unique slugs (with automatic 301 when a published URL changes);
**UAE projects cannot be published without the DLD permit number and QR code**; **commercial fields
(price, payment plan, handover) are hidden publicly until a Sales Approver approves them**, any change
resets approval, approvers cannot approve their own edits, and the approval date is shown as "as of";
construction updates require a date; media in use cannot be deleted; the last active administrator
cannot be removed or demoted.

## 4. Roles (RBAC — `lib/auth/permissions.ts`)

| Role | Summary |
|---|---|
| Administrator | Everything incl. users, theme, settings, applications (CVs) |
| Editor / Publisher | All content, publish/unpublish, menus, redirects, media, leads (view/export/resend), audit |
| Author | Own drafts only; submit for review; upload media |
| Sales Approver | Approve/reject commercial project fields; view content and leads |
| Viewer | Read-only content, media and leads |

The master prompt lists 11 roles; these five cover the same separations of duty for launch and can be
split further — permissions are already granular (20 permissions).

## 5. Security

- Argon2id passwords (OWASP parameters); generic login errors with timing equalisation; account lockout
  after 5 failures (15 min); DB-backed rate limits (login, forms, finder, payments, applications).
- Session = HTTP-only, SameSite=Lax, Secure (prod) JWT pointing to a DB `Session` row; 2 h idle / 12 h
  absolute; every request re-validates the session and user, so logout, deactivation, role change and
  password reset revoke access immediately.
- Server-side authorisation in every service; CSRF: Server Actions' built-in origin check plus explicit
  Origin checks on all state-changing Route Handlers.
- Rich text sanitised on save and render (allow-list); links restricted to http(s)/mailto/tel/relative;
  section/field schemas validate every block; JSON-LD escaped.
- Uploads: type by magic bytes (JPG/PNG/WebP/AVIF/GIF/PDF only — no SVG/HTML), size limits, images
  re-encoded with sharp (EXIF stripped, max 2560 px), random storage keys, traversal-proof serving with
  `nosniff`; PDFs served with a sandbox CSP. CVs stored outside the public directory; downloads audited.
- Leads: honeypot + minimum fill time + rate limit; CSV export neutralises formula injection.
- Headers: HSTS (prod), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, CSP
  `frame-ancestors/object-src/base-uri/form-action`; staging/dev send `X-Robots-Tag: noindex` and
  `robots.txt` disallows all. Admin is `no-store` and noindex.
- Audit log for sign-ins, lockouts, publishing, approvals, settings/theme, users, media, lead export/resend.

## 6. Integrations

| Integration | Status | Notes |
|---|---|---|
| **Bitrix24** (`crm.lead.add` via inbound webhook) | Built, needs PCI webhook URL | Lead stored first; delivered after response; retries with backoff (6 attempts) via cron; idempotent (checks `ORIGIN_ID` = submission id before re-sending); manual re-send; attempts visible in CMS. Passes contact, project, Bitrix project field, page, landing page, referrer, UTMs, click ids, consent. **Field mapping, pipelines, routing and duplicate rules must be agreed with Sales Ops.** |
| **Payment Service (Track C)** | Website side built; service not built | With `PAYMENT_SERVICE_URL` set, the entry page hands off (HMAC-signed request, https redirect only). Without it, an interim "request a secure payment link" form goes to Bitrix24 for Finance verification. Contract is a **proposal** in `server/integrations/payment-service.ts`. |
| **GA4 / GTM / Meta Pixel** | Data layer + consent built | GTM loads only after "Accept all". Events: project_view, category_browse, brochure_download, floor_plan_view, video_play, vr_start, chatbot_start/handover, form_start/submit, generate_lead (only after a stored submission), whatsapp_click, call_click, pay_installment_click, payment_page_start, share. Needs PCI's GTM container ID. Meta CAPI not built (P2). |
| **YouTube** | Built | Privacy-enhanced embeds with click-to-load facade. |
| **VR / 360°** | Built | Provider embed URLs (https) per project/unit; full-screen dialog + open-in-new-tab fallback; no empty VR sections. |
| **Maps** | Built (interim) | Google Maps embed by address/coordinates, no API key. Provider is an open decision. |
| **Chatbot** | Built (rule-based "Project Finder") | Grounded in published projects only; never shows unapproved prices; hand-over creates a CHATBOT lead. The Bitrix24-bot vs website-assistant ADR is still open. |

## 7. HTTP API

All JSON errors: `{ "error": { "code" }, "message", "fieldErrors"? }` with proper status codes.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/leads` | Same-origin | Submit an enquiry (201 `{ id, reference }`) |
| `POST /api/project-finder` | Same-origin | `{ market, category, status, budgetMax?, currency? }` → recommendations |
| `POST /api/payments/start` | Same-origin | `{ bookingReference }` → `{ redirectUrl }` (Payment Service mode) |
| `POST /api/careers/apply` | Same-origin | Multipart application with PDF CV |
| `GET /api/v1/projects?category=&status=` | Public | Published projects (approved prices only) |
| `GET /api/health` | Public | Liveness + DB check |
| `POST /api/admin/media` · `POST /api/admin/media/:id/replace` | CMS session | Upload / replace (same URL) |
| `GET /api/admin/leads/export` | `leads.export` | CSV export |
| `GET /api/admin/applications/:id/cv` | `applications.read` | Private CV download |
| `POST /api/cron/deliver-leads` | `Bearer CRON_SECRET` | CRM retries + housekeeping |

CMS mutations use Server Actions in `src/app/admin/actions/`.

## 8. Testing (all passing at hand-over)

- **Unit (46):** RBAC, workflow, slugs/YouTube/phone/link safety, sanitisation, file-type sniffing,
  section/theme/lead/project/redirect validation, Bitrix24 mapping & error classification, payment
  signing, proxy routing decisions, JWT tampering/expiry.
- **Integration (23, real PostgreSQL):** page workflow, revisions/restore, auto-redirects, reserved and
  duplicate slugs, DLD publish block, commercial approval & separation of duties, update validation,
  theme/menu/redirect validation, login/lockout/revocation/deactivation, last-admin protection, upload
  security, media-in-use protection, lead storage, anti-spam, CRM retry + idempotency.
- **E2E (9, Playwright):** public browsing, draft privacy, 301/404 statuses, CMS access control and
  cross-site rejection, sign-in/out, page build → publish, duplicate slug, author restrictions, theme
  applied publicly, form validation + success with an unreachable CRM, disguised upload rejection.

## 9. Not done / needs PCI input

**Needs PCI input:** CIO approval of PostgreSQL; Bitrix24 webhook and field/pipeline mapping; GTM
container ID; WhatsApp (Bitrix24-connected) number; DLD permit numbers + QR codes for Gateway, Barari
Views and Fortunato (seeded as drafts); approved prices/payment plans (none seeded); brochures, floor
plans, VR tour URLs, leadership photos; confirmation of seeded statistics (2011 / 25+ / 12 / 4, taken
from the current site's FAQ); Legal review of privacy, terms and cookie text; cookie-consent solution
choice; map provider; HR mailbox/ATS for applications.

**Not built yet (from the master prompt):** MFA for CMS users (recommended next step, mandatory for
privileged roles); scheduled *expiry*/unpublish dates (publish scheduling is done); form builder (forms
are fixed types with Bitrix24 mapping in code); localisation/RTL content model (layout uses logical
CSS properties, so it is RTL-ready); Meta CAPI; channel-partner portal (P3); the Payment Service itself
(Track C); landing-page-specific campaign settings beyond normal pages; Docker/CI pipeline definitions;
data-retention jobs for leads/CVs (periods are an open Legal decision).

**Known limitations:** "gated" brochures are soft-gated (the file URL is not secret once shared);
new URLs reach the proxy's routing index within about a second, and unpublished URLs can render a
soft-404 for up to 15 s; the in-memory `use cache` store is per instance (use `'use cache: remote'`
or a shared cache handler if running several instances); `npm audit` reports advisories in the ESLint
dev toolchain only (not shipped).
