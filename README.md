# PCI-Orbit — Website & CMS

Corporate website, real-estate CMS and lead platform for **Premier Choice International**.
One Next.js 16 full-stack application: public website, CMS at `/admin`, and REST endpoints.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
shadcn/ui (Radix) · PostgreSQL · Prisma 7 · JWT sessions (jose) · Argon2id · Zod · Vitest · Playwright.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for design decisions, security, caching,
integrations, the API reference and the open items PCI needs to provide.

## Quick start (local development)

Requirements: Node.js 24+, npm 11+. PostgreSQL is optional — a local server is bundled.

```bash
cd frontend
npm install
npm install-scripts approve prisma @prisma/engines @embedded-postgres/windows-x64 esbuild unrs-resolver  # npm 11 blocks install scripts by default; `npm rebuild` afterwards
cp .env.example .env              # then set AUTH_SECRET

npm run db:start                  # terminal 1: local PostgreSQL 18 on :54329 (UTF-8)
npm run db:deploy                 # terminal 2: apply migrations
npm run seed:assets               # optional: download images from the current public site (read-only)
SEED_ADMIN_PASSWORD='your-password' npm run db:seed
npm run dev                       # http://localhost:3000  ·  CMS: http://localhost:3000/admin
```

The seed prints the CMS accounts it creates (`admin@pci-orbit.local` plus one demo account per role
in non-production). Change passwords after first sign-in.

> Using your own PostgreSQL instead? Create a **UTF-8** database, set `DATABASE_URL`, and skip `db:start`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm run db:start` | Local PostgreSQL (embedded; dev and tests only) |
| `npm run db:migrate` | Create/apply a migration after editing `prisma/schema.prisma` (dev) |
| `npm run db:deploy` | Apply migrations (staging/production) |
| `npm run db:seed` | Seed an empty database |
| `npm run seed:assets` | Re-download seed images/posts from premierchoiceint.com (public GETs only) |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright; builds against the `pci_e2e` database) |
| `npm run diagnose:ui` | Browser checks against a running site on :3000 — responsive layout invariants and scroll-preserving filters |
| `npm run media:restore` | Re-create missing media files from `prisma/seed-assets` (keeps URLs; no database changes) |

Tests need the local database running (`npm run db:start`). Integration tests use `pci_test` and
e2e uses `pci_e2e`; both are emptied by the test helpers, which refuse to run against any other
database name. First e2e run: `npx playwright install chromium`.

## Project structure

```
frontend/
├─ prisma/                schema, migrations, seed (+ seed-content, seed-assets)
├─ scripts/               dev-db.mjs (local PostgreSQL), fetch-seed-assets.mjs
├─ src/
│  ├─ app/
│  │  ├─ (site)/          public website routes (CMS pages, projects, updates, media, careers, payment…)
│  │  ├─ admin/           CMS (login, (cms)/… screens, preview/, actions/ = Server Actions)
│  │  ├─ api/             Route Handlers (leads, project finder, payments, careers, admin, cron, v1)
│  │  ├─ uploads/         public media file serving
│  │  └─ sitemap.ts, robots.ts
│  ├─ components/         site/ (public UI), admin/ (CMS UI), ui/ (shadcn)
│  ├─ lib/                auth/, validation/, sections/ (page-builder registry), fields.ts, theme.ts, settings.ts…
│  ├─ server/             services/ (business logic), integrations/, public-data.ts (cached reads), db.ts
│  └─ proxy.ts            CMS session check, redirects and 404 statuses
├─ tests/                 unit/ and integration/ (Vitest)
└─ e2e/                   Playwright journeys
```

## Deployment

1. Provision PostgreSQL (UTF-8, session time zone irrelevant — the app forces UTC) and persistent
   storage for `UPLOAD_DIR` and `PRIVATE_UPLOAD_DIR`.
2. Set environment variables from `.env.example` in the host's secret manager
   (`SITE_ENV=production` only on the live site; staging must stay `staging` and be password-protected).
3. `npm ci && npm run db:deploy && npm run build && npm start` (Node.js 24). Terminate HTTPS at the
   load balancer / reverse proxy.
4. Schedule `POST /api/cron/deliver-leads` with `Authorization: Bearer $CRON_SECRET` every 1–5 minutes.
5. First install only: `npm run db:seed` (or import content), then sign in and change the admin password.
6. Back up the database and the upload volumes daily; test restores.

The database is required at build time (published pages are prerendered).
