/**
 * Development / initial-content seed.
 *
 * Content comes from PCI's current public website (see scripts/fetch-seed-assets.mjs)
 * and is used as the starting point for Marketing to review — it is not
 * invented. Items that need PCI confirmation are left blank or as drafts:
 *  - UAE projects stay DRAFT until DLD permit numbers + QR codes are entered.
 *  - No prices / payment plans are seeded (they need Sales approval).
 *  - WhatsApp number and GTM container ID must be provided by PCI.
 *
 * Run: npm run db:seed  (only seeds an empty database unless SEED_FORCE=true)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { hashPassword } from "@/server/services/auth";
import { uploadMedia } from "@/server/services/media";
import { sanitizeRichText } from "@/lib/sanitize";
import { DEFAULT_THEME } from "@/lib/theme";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/settings";
import { randomId, type Section } from "@/lib/sections/registry";
import { htmlToText, truncate } from "@/lib/text";
import type { Actor } from "@/lib/auth/permissions";

const ASSETS = path.resolve("prisma/seed-assets");
const manifest: {
  brand: Record<string, string>;
  cards: Record<string, string>;
  updates: Record<string, { month: string; files: string[] }[]>;
  posts: { slug: string; title: string; date: string; excerpt: string; content: string; cover: string | null; coverAlt: string }[];
} = fs.existsSync(path.join(ASSETS, "manifest.json"))
  ? JSON.parse(fs.readFileSync(path.join(ASSETS, "manifest.json"), "utf8"))
  : { brand: {}, cards: {}, updates: {}, posts: [] };

const decode = (s: string) =>
  s.replace(/&#8217;|&rsquo;/g, "’").replace(/&#8216;/g, "‘").replace(/&#8220;|&#8221;/g, '"').replace(/&#038;|&amp;/g, "&").replace(/&#8211;/g, "–").replace(/&nbsp;/g, " ");

const section = (type: string, data: Record<string, unknown>): Section => ({ id: randomId(), type, hidden: false, data });

async function main() {
  const force = process.env.SEED_FORCE === "true";
  if (!force && (await db.user.count()) > 0) {
    console.log("Database already contains data — skipping seed (set SEED_FORCE=true to seed anyway).");
    return;
  }

  // ───────── Users ─────────
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@pci-orbit.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? `Pci-${crypto.randomBytes(9).toString("base64url")}9a`;
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, name: "PCI Administrator", role: "ADMIN", passwordHash: await hashPassword(adminPassword) },
  });
  const actor: Actor = { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN" };
  const credentials: [string, string, string][] = [["ADMIN", adminEmail, adminPassword]];

  if (process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_USERS !== "false") {
    // Never reuse the admin password: demo logins are handed to testers.
    const demoPassword = process.env.SEED_DEMO_PASSWORD || `Pci-${crypto.randomBytes(9).toString("base64url")}9d`;
    for (const [role, name] of [["EDITOR", "Marketing Editor"], ["AUTHOR", "Content Author"], ["SALES_APPROVER", "Sales Approver"], ["VIEWER", "Lead Viewer"]] as const) {
      const email = `${role.toLowerCase().replace("_", "-")}@pci-orbit.local`;
      await db.user.upsert({ where: { email }, update: {}, create: { email, name, role, passwordHash: await hashPassword(demoPassword) } });
      credentials.push([role, email, demoPassword]);
    }
  }

  // ───────── Media ─────────
  const uploaded = new Map<string, string>();
  async function media(file: string | null | undefined, alt: string, tags: string[] = []): Promise<string | null> {
    if (!file) return null;
    if (uploaded.has(file)) return uploaded.get(file)!;
    const full = path.join(ASSETS, file);
    if (!fs.existsSync(full)) return null;
    try {
      const m = await uploadMedia(actor, { data: fs.readFileSync(full), originalName: file, alt, title: alt, tags });
      uploaded.set(file, m.id);
      return m.id;
    } catch (e) {
      console.warn(`  skipped ${file}: ${(e as Error).message}`);
      return null;
    }
  }

  const logo = await media(manifest.brand.logo, "Premier Choice International logo", ["brand"]);
  const logoLight = await media(manifest.brand.logoLight, "Premier Choice International logo", ["brand"]);
  const homeBanner = await media(manifest.brand.homeBanner, "Premier Choice International development", ["brand", "hero"]);
  const hiltonLogo = await media(manifest.brand.hilton, "Hilton Garden Inn logo", ["partner"]);

  // ───────── Settings & theme ─────────
  const settings: SiteSettings = structuredClone(DEFAULT_SETTINGS);
  settings.general = {
    siteName: "Premier Choice International",
    tagline: "Inspiring Lifestyles",
    logo,
    logoLight,
    footerAbout:
      "Premier Choice International is a residential and commercial real estate developer, established in Pakistan in 2011 and in Dubai in 2021.",
    copyright: `© ${new Date().getFullYear()} Premier Choice International. All rights reserved.`,
  };
  settings.contact = {
    phone: "+92 301 123 3333",
    whatsapp: "", // PCI to provide the Bitrix24-connected WhatsApp number.
    whatsappMessage: "Hello PCI, I'd like more information.",
    email: "info@premierchoiceint.com",
    offices: [
      {
        name: "Pakistan Office",
        address: "Plot No. 67 A-1, Bahria Food Street\nBahria Springs North Commercial, Phase 7\nBahria Town, Islamabad, Pakistan",
        phone: "+92 51 8738545",
        email: "info@premierchoiceint.com",
        hours: "Monday to Saturday: 9:00 am to 8:00 pm",
        mapQuery: "Bahria Food Street, Bahria Springs North Commercial, Phase 7, Bahria Town, Islamabad",
      },
      {
        name: "Dubai Head Office",
        address: "Office 1013, Onyx Tower 1\nThe Greens, Dubai\nUnited Arab Emirates",
        phone: "+971 4 591 7499",
        email: "info@premierchoiceint.com",
        hours: "Monday to Saturday: 9:00 am to 8:00 pm",
        mapQuery: "Onyx Tower 1, The Greens, Dubai",
      },
    ],
  };
  settings.social = {
    facebook: "https://www.facebook.com/Premierchoiceinternational",
    instagram: "https://www.instagram.com/premierchoiceinternational",
    linkedin: "https://www.linkedin.com/company/37547748/",
    youtube: "https://www.youtube.com/channel/UCB_A-rmmMaVKGfeqB8jAOww",
    x: "https://twitter.com/PremierChoiceIn",
    tiktok: "",
  };
  settings.seo = {
    defaultTitle: "Premier Choice International | Real Estate Developer in Pakistan & Dubai",
    titleSuffix: "| Premier Choice International",
    defaultDescription:
      "Premier Choice International develops residential, commercial and mixed-use real estate in Islamabad and Dubai. Explore projects, construction updates and enquire today.",
    defaultOgImage: homeBanner,
  };
  settings.payment.intro =
    "<p>Existing PCI customers can pay installments securely online. Please have your booking reference ready.</p><p>Card details are entered only on the approved payment provider's secure page — never on this website.</p>";
  settings.chatbot.greeting = "Tell us what you are looking for and we'll suggest suitable PCI projects.";
  settings.chatbot.disclaimer =
    "Suggestions are based on published project information only. They are not an offer and do not confirm prices or availability — our sales team will confirm details.";

  await db.siteSettings.upsert({ where: { id: "default" }, update: { data: settings as unknown as Prisma.InputJsonValue }, create: { id: "default", data: settings as unknown as Prisma.InputJsonValue } });
  await db.themeSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default", tokens: DEFAULT_THEME as unknown as Prisma.InputJsonValue, updatedById: admin.id } });

  // ───────── Locations ─────────
  // Centre coordinates from OpenStreetMap (Nominatim, ODbL) — approximate area centres.
  const locations = [
    { slug: "dha-phase-1-islamabad", name: "DHA Phase 1", city: "Islamabad", market: "PAKISTAN" as const, card: "grand-orchard", lat: 33.5379275, lng: 73.101301 },
    { slug: "bahria-town-islamabad", name: "Bahria Town", city: "Islamabad", market: "PAKISTAN" as const, card: "68-high-street", lat: 33.530822, lng: 73.1179633 },
    { slug: "bahria-intellectual-village", name: "Bahria Intellectual Village", city: "Islamabad", market: "PAKISTAN" as const, card: "buraq-heights", lat: 33.5272137, lng: 73.0929693 },
    { slug: "jumeirah-village-circle", name: "Jumeirah Village Circle", city: "Dubai", market: "UAE" as const, card: "gateway", lat: 25.0565882, lng: 55.2079869 },
    { slug: "al-barari", name: "Al Barari", city: "Dubai", market: "UAE" as const, card: "barari-views", lat: 25.1082771, lng: 55.31877 },
  ];
  const locationIds: Record<string, string> = {};
  for (const l of locations) {
    const hero = await media(manifest.cards[l.card], `${l.name}, ${l.city}`, ["location"]);
    const row = await db.location.create({
      data: {
        slug: l.slug,
        name: l.name,
        city: l.city,
        market: l.market,
        summary: `Premier Choice International developments in ${l.name}, ${l.city}.`,
        overview: `<p>Explore PCI projects located in ${l.name}, ${l.city}.</p>`,
        heroImageId: hero,
        latitude: l.lat,
        longitude: l.lng,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    locationIds[l.slug] = row.id;
  }

  // ───────── Projects (from the current website's project listing) ─────────
  type Seed = { slug: string; name: string; address: string; city: string; market: "PAKISTAN" | "UAE" | "CANADA"; status: "ONGOING" | "COMPLETED"; area: string; type: string; category: "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE" | "RETAIL" | "HOSPITALITY"; location?: string; featured?: boolean; lat?: number; lng?: number };
  const projects: Seed[] = [
    { slug: "grand-orchard", name: "Grand Orchard", address: "DHA Phase 1, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "ONGOING", area: "1,000,000 sq ft", type: "Commercial & Residential", category: "MIXED_USE", location: "dha-phase-1-islamabad", featured: true, lat: 33.5487378, lng: 73.0905512 },
    { slug: "gateway", name: "Gateway", address: "Jumeirah Village Circle, Dubai", city: "Dubai", market: "UAE", status: "ONGOING", area: "300,000 sq ft", type: "Residential & Commercial", category: "MIXED_USE", location: "jumeirah-village-circle", featured: true },
    { slug: "buraq-heights", name: "Buraq Heights", address: "Bahria Intellectual Village, Phase 7, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "ONGOING", area: "200,000 sq ft", type: "Residential", category: "RESIDENTIAL", location: "bahria-intellectual-village", featured: true },
    { slug: "barari-views", name: "Barari Views", address: "Majan, Al Barari, Dubai", city: "Dubai", market: "UAE", status: "ONGOING", area: "56,000 sq ft", type: "Residential", category: "RESIDENTIAL", location: "al-barari", featured: true },
    { slug: "river-courtyard", name: "River Courtyard", address: "Bahria Intellectual Village, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "ONGOING", area: "450,000 sq ft", type: "Residential + Commercial", category: "MIXED_USE", location: "bahria-intellectual-village", featured: true },
    { slug: "river-courtyard-2", name: "River Courtyard II", address: "Bahria Intellectual Village, Phase 7, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "ONGOING", area: "400,000 sq ft", type: "Residential + Commercial", category: "MIXED_USE", location: "bahria-intellectual-village" },
    { slug: "river-hills-5", name: "River Hills 5", address: "DHA Phase 1, Sector F, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "ONGOING", area: "200,000 sq ft", type: "Residential", category: "RESIDENTIAL", location: "dha-phase-1-islamabad", featured: true },
    { slug: "spring-arch", name: "Spring Arch", address: "District Commercial, Bahria Town Phase 8, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "ONGOING", area: "80,000 sq ft", type: "Commercial + Residential", category: "MIXED_USE", location: "bahria-town-islamabad" },
    { slug: "roman-grove-1", name: "Roman Grove I", address: "DHA Phase 1, Sector F, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "ONGOING", area: "90,000 sq ft", type: "Commercial + Residential", category: "MIXED_USE", location: "dha-phase-1-islamabad" },
    { slug: "roman-grove-2", name: "Roman Grove II", address: "DHA Phase 1, Sector F, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "ONGOING", area: "30,000 sq ft", type: "Offices + Clinics", category: "COMMERCIAL", location: "dha-phase-1-islamabad" },
    { slug: "box-park-2", name: "Box Park II", address: "Bahria Food Street, Phase 7, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "ONGOING", area: "30,000 sq ft", type: "Mall", category: "RETAIL", location: "bahria-town-islamabad" },
    { slug: "grand-gallery", name: "Grand Gallery", address: "Bahria Food Street, Phase 7, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "ONGOING", area: "30,000 sq ft", type: "Mall", category: "RETAIL", location: "bahria-town-islamabad" },
    { slug: "68-high-street", name: "68 High Street", address: "Bahria Food Street, Phase 7, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "COMPLETED", area: "200,000 sq ft", type: "Mall", category: "RETAIL", location: "bahria-town-islamabad" },
    { slug: "box-park", name: "Box Park", address: "Bahria Food Street, Phase 7, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "COMPLETED", area: "130,000 sq ft", type: "Mall", category: "RETAIL", location: "bahria-town-islamabad" },
    { slug: "fortunato", name: "Fortunato", address: "Jumeirah Village Circle, Dubai", city: "Dubai", market: "UAE", status: "COMPLETED", area: "650,000 sq ft", type: "Residential", category: "RESIDENTIAL", location: "jumeirah-village-circle", lat: 25.0654817, lng: 55.2128395 },
    { slug: "river-loft", name: "River Loft", address: "Bahria Intellectual Village, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "COMPLETED", area: "252,000 sq ft", type: "Residential", category: "RESIDENTIAL", location: "bahria-intellectual-village" },
    { slug: "river-hills-1", name: "River Hills I", address: "Bahria Town Phase 7, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "COMPLETED", area: "165,000 sq ft", type: "Commercial + Residential", category: "MIXED_USE", location: "bahria-town-islamabad" },
    { slug: "river-hills-2", name: "River Hills 2", address: "Bahria Town Phase 7, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "COMPLETED", area: "55,000 sq ft", type: "Commercial + Residential", category: "MIXED_USE", location: "bahria-town-islamabad" },
    { slug: "river-hills-3", name: "River Hills 3", address: "Bahria Town Phase 7, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "COMPLETED", area: "60,000 sq ft", type: "Commercial + Residential", category: "MIXED_USE", location: "bahria-town-islamabad" },
    { slug: "river-hills-4", name: "River Hills 4", address: "Bahria Town Phase 7, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "COMPLETED", area: "63,000 sq ft", type: "Commercial + Residential", category: "MIXED_USE", location: "bahria-town-islamabad" },
    { slug: "stettler-crossroads", name: "Stettler Crossroads", address: "Stettler, Alberta, Canada", city: "Stettler", market: "CANADA", status: "COMPLETED", area: "150,000 sq ft", type: "Commercial", category: "COMMERCIAL" },
    { slug: "tuscany-courtyard", name: "Tuscany Courtyard", address: "Bahria Food Street, Phase 7, Islamabad", city: "Islamabad", market: "PAKISTAN", status: "COMPLETED", area: "4,000 sq ft", type: "Restaurant", category: "HOSPITALITY", location: "bahria-town-islamabad" },
  ];

  const projectIds: Record<string, string> = {};
  const now = new Date();
  for (const [i, p] of projects.entries()) {
    const image = await media(manifest.cards[p.slug], `${p.name}, ${p.address}`, ["project", p.slug]);
    const statusText = p.status === "COMPLETED" ? "completed" : "under construction";
    const overview = `<p>${p.name} is a ${p.type.toLowerCase()} development by Premier Choice International in ${p.address}, with approximately ${p.area} of development. The project is ${statusText}.</p><p>Contact our sales team for brochures, floor plans, availability and current payment plans.</p>`;
    // UAE projects cannot be published without the DLD permit number and QR code.
    const publishable = !!image && p.market !== "UAE";
    const row = await db.project.create({
      data: {
        slug: p.slug,
        name: p.name,
        category: p.category,
        constructionStatus: p.status,
        market: p.market,
        city: p.city,
        address: p.address,
        latitude: p.lat ?? null,
        longitude: p.lng ?? null,
        locationId: p.location ? locationIds[p.location] : null,
        overview,
        heroImageId: image,
        cardImageId: image,
        keyFacts: [{ label: "Total area", value: p.area }, { label: "Type", value: p.type }],
        isFeatured: !!p.featured,
        sortOrder: i * 10,
        status: publishable ? "PUBLISHED" : "DRAFT",
        publishedAt: publishable ? now : null,
        authorId: admin.id,
        updatedById: admin.id,
      },
    });
    projectIds[p.slug] = row.id;
  }

  // ───────── Construction updates (dated archive) ─────────
  for (const [slug, months] of Object.entries(manifest.updates)) {
    const projectId = projectIds[slug];
    const project = projects.find((p) => p.slug === slug);
    if (!projectId || !project) continue;
    for (const { month, files } of months) {
      const [y, m] = month.split("/").map(Number);
      const date = new Date(Date.UTC(y, m - 1, 1));
      const label = date.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
      const images = (await Promise.all(files.map((f, k) => media(f, `${project.name} construction progress, ${label} (${k + 1})`, ["construction", slug])))).filter((x): x is string => !!x);
      await db.projectUpdate.create({
        data: {
          projectId,
          slug: `${slug}-${y}-${String(m).padStart(2, "0")}`,
          title: `${project.name} — ${label} progress`,
          date,
          summary: `Construction progress photographs of ${project.name} from ${label}.`,
          status: "PUBLISHED",
          publishedAt: date,
          authorId: admin.id,
          images: { create: images.map((mediaId, order) => ({ mediaId, order })) },
        },
      });
      // Add the photos to the project gallery as well.
      const existing = await db.projectGalleryItem.count({ where: { projectId } });
      if (existing < 6) {
        await db.projectGalleryItem.createMany({ data: images.slice(0, 6 - existing).map((mediaId, k) => ({ projectId, mediaId, order: existing + k })) });
      }
    }
  }

  // ───────── News & media (existing posts) ─────────
  const redirects: { fromPath: string; toPath: string; note: string }[] = [];
  for (const post of manifest.posts) {
    const title = decode(post.title);
    const slug = post.slug.length <= 96 ? post.slug : post.slug.slice(0, 96).replace(/-[^-]*$/, "");
    const isCompanyNews = /premier choice|pci|hilton|iso|gateway/i.test(title);
    const cover = await media(post.cover, post.coverAlt || title, ["news"]);
    await db.article.create({
      data: {
        slug,
        title,
        category: isCompanyNews ? "NEWS" : "BLOG",
        excerpt: truncate(htmlToText(decode(post.excerpt)), 380),
        body: sanitizeRichText(post.content),
        coverImageId: cover,
        status: "PUBLISHED",
        publishedAt: new Date(post.date),
        authorId: admin.id,
      },
    });
    redirects.push({ fromPath: `/${post.slug}`, toPath: `/media/${slug}`, note: "WordPress post migrated" });
  }

  // ───────── FAQs (safe, general answers from the current FAQ page) ─────────
  const faqs: [string, string, string][] = [
    ["general", "What does Premier Choice International do?", "Premier Choice International is a residential and commercial real estate developer. Our team of project managers oversees every stage of design, development and delivery, and our facilities management team continues to look after properties after handover."],
    ["general", "Who is the CEO of Premier Choice International?", "Mr. Amran Zia is the founder and CEO of the company."],
    ["general", "Which countries has Premier Choice International developed projects in?", "<ul><li>Dubai, United Arab Emirates</li><li>Islamabad, Pakistan</li><li>Alberta, Canada</li><li>New York, United States</li></ul>"],
    ["general", "Does PCI undertake residential or commercial developments?", "Both — PCI develops residential, commercial and mixed-use projects."],
    ["general", "Does PCI manage the properties after construction?", "Yes. Our Facilities Management department looks after the premises and resolves matters at both residential and commercial properties."],
    ["investment", "Do you offer furnished or non-furnished apartments?", "Both options are available, depending on the project."],
    ["investment", "Can I sell my property while installments are ongoing?", "Resale is possible once 50% of the total amount has been paid, subject to a small transfer fee. Contact our team for assistance."],
    ["payments", "Is it installments or full cash payment?", "Clients can choose either option, depending on the project."],
    ["payments", "Are the installments monthly or quarterly?", "Both options are available; the choice is up to the client, subject to the project's approved payment plan."],
    ["payments", "Can the down payment be divided into installments?", "Yes, the down payment can be divided into two installments. Any further division may be possible subject to approval."],
    ["payments", "How long can a property be held on a token?", "For a maximum of 15 days. If the down payment is not received within that time, the booking lapses."],
    ["payments", "Can I pay two or more installments together?", "Yes. Installments can be arranged to suit your requirements, subject to PCI's approval. Existing customers can use Pay My Installment for online payments."],
  ];
  await db.faq.createMany({ data: faqs.map(([category, question, answer], order) => ({ category, question, answer: answer.startsWith("<") ? answer : `<p>${answer}</p>`, order })) });

  // ───────── Pages ─────────
  const card = (slug: string) => uploaded.get(manifest.cards[slug] ?? "") ?? null;
  const stats = section("stats", {
    eyebrow: "PCI in numbers",
    heading: "",
    intro: "",
    background: "dark",
    items: [
      { value: "2011", suffix: "", label: "Established in Pakistan" },
      { value: "25", suffix: "+", label: "Development projects" },
      { value: "12", suffix: "", label: "Projects delivered" },
      { value: "4", suffix: "", label: "Countries" },
    ],
  });
  const expertise = section("featureGrid", {
    eyebrow: "Our expertise",
    heading: "Building value beyond construction",
    intro: "Premier Choice International provides a full-service experience that continues long after a project is delivered.",
    columns: "4",
    background: "muted",
    items: [
      { title: "Investment management", description: "Guidance for investors across PCI's portfolio.", image: null, href: "" },
      { title: "Design, project & development management", description: "Experienced project managers oversee every detail from design to delivery.", image: null, href: "" },
      { title: "Rental & leasing assistance", description: "Support for owners letting their residential and commercial units.", image: null, href: "" },
      { title: "Property & facilities management", description: "A dedicated team cares for our buildings after handover.", image: null, href: "" },
    ],
  });
  const enquiry = (formType = "CONTACT", heading = "Speak to our team") =>
    section("enquiry", { eyebrow: "Get in touch", heading, intro: "Share your details and our sales team will contact you.", formType, projectId: null, showOffices: formType === "CONTACT", background: "default" });

  const heroImages = [homeBanner, card("grand-orchard"), card("buraq-heights")].filter(Boolean);
  const pages: { slug: string; title: string; excerpt?: string; seoDescription?: string; sections: Section[]; noindex?: boolean }[] = [
    {
      slug: "home",
      title: "Home",
      seoDescription: settings.seo.defaultDescription,
      sections: [
        section("hero", {
          eyebrow: "Premier Choice International",
          heading: "Inspiring Lifestyles",
          subheading: "Creating a world of possibilities across Pakistan and the UAE.",
          images: heroImages,
          youtubeId: "",
          ctaLabel: "Explore projects",
          ctaHref: "/projects",
          secondaryCtaLabel: "Enquire now",
          secondaryCtaHref: "/contact",
          height: "full",
          showFinder: true,
        }),
        section("paymentCta", { heading: "Existing customer? Pay your installment online", text: "Securely pay installments for your PCI property." }),
        section("imageText", {
          eyebrow: "Who we are",
          heading: "Setting the standard in real estate development",
          body: "<p>At Premier Choice International, we're setting the standard for excellence in real estate development by delivering seamless solutions for all your property needs. Since our establishment in Pakistan in 2011, followed by our operations in Dubai in 2021, our forward-thinking approach has ensured a stress-free real estate experience for our clients.</p>",
          image: card("river-loft") ?? card("68-high-street"),
          imagePosition: "right",
          ctaLabel: "About PCI",
          ctaHref: "/about",
          background: "default",
        }),
        stats,
        section("projectCategories", {
          eyebrow: "Browse",
          heading: "Find the right property",
          intro: "",
          background: "default",
          items: [
            { category: "RESIDENTIAL", label: "", image: card("buraq-heights") },
            { category: "COMMERCIAL", label: "", image: card("roman-grove-2") },
            { category: "MIXED_USE", label: "", image: card("grand-orchard") },
            { category: "RETAIL", label: "", image: card("68-high-street") },
          ],
        }),
        section("featuredProjects", { eyebrow: "Featured projects", heading: "Realise your investment potential", intro: "", mode: "featured", category: "RESIDENTIAL", projectIds: [], limit: 6, showAllLink: true, background: "muted" }),
        section("latestUpdates", { eyebrow: "Construction progress", heading: "Latest project updates", intro: "", limit: 3, background: "default" }),
        expertise,
        section("vrShowcase", { eyebrow: "Virtual experiences", heading: "Explore in 360°", intro: "", limit: 3, background: "dark" }),
        section("latestArticles", { eyebrow: "News & media", heading: "Latest from PCI", intro: "", category: "ALL", limit: 3, background: "default" }),
        enquiry("CONTACT", "Let's find your next property"),
      ],
    },
    {
      slug: "about",
      title: "About PCI",
      excerpt: "All your real estate needs under one roof.",
      sections: [
        section("imageText", {
          eyebrow: "About us",
          heading: "All your real estate needs under one roof",
          body: "<p>Premier Choice is a trusted name in residential and commercial real estate development, renowned for our commitment to creating value in every project we undertake. Our portfolio showcases the best in aesthetic design and a community-focused approach.</p><p>With a team of expert project managers, we ensure that every detail is executed to perfection, delivering beautiful spaces and lasting value for our partners.</p>",
          image: card("grand-orchard"),
          imagePosition: "right",
          ctaLabel: "",
          ctaHref: "",
          background: "default",
        }),
        section("imageText", {
          eyebrow: "Beyond delivery",
          heading: "Realising real estate dreams",
          body: "<p>At Premier Choice, we believe in providing a full-service experience that extends beyond the construction of your development. Our expertise in property management, facilities management and hospitality allows us to keep adding value to your investment long after the project is delivered.</p>",
          image: card("river-courtyard"),
          imagePosition: "left",
          ctaLabel: "View our projects",
          ctaHref: "/projects",
          background: "muted",
        }),
        stats,
        expertise,
        section("cta", { heading: "Discover PCI projects", text: "Residential, commercial and mixed-use developments in Islamabad and Dubai.", ctaLabel: "Explore projects", ctaHref: "/projects", image: homeBanner }),
      ],
    },
    {
      slug: "about/vision-values",
      title: "Vision & Values",
      excerpt: "Our goal then and now is to provide quality projects.",
      sections: [
        section("richText", {
          eyebrow: "Our purpose",
          heading: "Mission & vision",
          intro: "",
          body: "<h3>Mission</h3><p>To create maximum value for all parties involved in real estate — from pre-development investors to rental tenants.</p><h3>Vision</h3><p>To be the most trusted name in real estate, continuously striving to provide the best living experience: today better than yesterday, tomorrow better than today.</p>",
          width: "narrow",
          background: "default",
        }),
        section("featureGrid", {
          eyebrow: "Our values",
          heading: "What guides us",
          intro: "",
          columns: "3",
          background: "muted",
          items: [
            { title: "Elevating life", description: "Improving quality of life for individuals, families and communities by creating exceptional living, work and recreational environments.", image: null, href: "" },
            { title: "High-quality products", description: "Designs that blend with their surroundings to offer the best living conditions for families.", image: null, href: "" },
            { title: "Comprehensive amenities", description: "Reliable utilities, backup power, landscaped streets and shared amenities for residents.", image: null, href: "" },
          ],
        }),
      ],
    },
    {
      slug: "about/leadership",
      title: "Leadership",
      excerpt: "Revolutionising real estate developments with a visionary team.",
      sections: [
        section("team", {
          eyebrow: "Leadership",
          heading: "Meet the team",
          intro: "Premier Choice International is led by an experienced corporate team committed to integrity, quality and lasting value.",
          background: "default",
          members: [
            { name: "Amran Zia", role: "Founder & Chief Executive Officer", bio: "Premier Choice International was founded by Mr. Amran Zia in Pakistan in 2011 and in Dubai in 2021, and has been in a phase of rapid growth since its establishment.", photo: null },
            { name: "Mahhad Imran", role: "Managing Director", bio: "Formerly with PwC Dubai, LDA Capital Los Angeles and KSR New York. Honours graduate of UCLA.", photo: null },
          ],
        }),
      ],
    },
    {
      slug: "about/journey",
      title: "Our Journey",
      excerpt: "Milestones in the PCI story.",
      sections: [
        section("timeline", {
          eyebrow: "Mapping our journey",
          heading: "Milestones",
          intro: "",
          background: "default",
          items: [
            { year: "2011", title: "Premier Choice International established in Pakistan", description: "PCI begins developing residential and commercial projects in Islamabad." },
            { year: "2021", title: "Operations established in Dubai", description: "PCI expands into the UAE with developments in Dubai." },
            { year: "2023", title: "ISO 9001:2015 certification", description: "PCI's quality management is certified to ISO 9001:2015." },
            { year: "2023", title: "Agreement with Hilton Garden Inn", description: "PCI signs with Hilton Garden Inn to bring the hotel chain to Grand Orchard in DHA Phase 1, Islamabad." },
          ],
        }),
      ],
    },
    {
      slug: "about/partners",
      title: "Partners",
      excerpt: "Collaborators who help us deliver.",
      sections: [
        section("logos", { eyebrow: "Partners", heading: "Our partners & collaborators", intro: "", background: "default", items: hiltonLogo ? [{ name: "Hilton Garden Inn", logo: hiltonLogo, href: "" }] : [] }),
        section("richText", { eyebrow: "", heading: "Sales partners", intro: "", body: "<p>Zameen.com is PCI's selling partner, marketing and selling selected projects. All other aspects of project management, from start to after handover, remain PCI's responsibility.</p>", width: "narrow", background: "muted" }),
      ],
    },
    {
      slug: "invest-with-pci",
      title: "Invest with PCI",
      excerpt: "Investment information, buying guide and frequently asked questions.",
      sections: [
        section("featureGrid", {
          eyebrow: "Buying guide",
          heading: "How buying with PCI works",
          intro: "A simple overview of the typical process. Exact terms depend on each project's approved payment plan.",
          columns: "3",
          background: "default",
          items: [
            { title: "1. Choose a project", description: "Browse projects or use the Project Finder, then speak to our sales team.", image: null, href: "/projects" },
            { title: "2. Reserve with a token", description: "A unit can be held on a token for up to 15 days while the down payment is arranged.", image: null, href: "" },
            { title: "3. Down payment", description: "The down payment may be divided into two installments, subject to approval.", image: null, href: "" },
            { title: "4. Installments", description: "Pay in monthly or quarterly installments according to the project's payment plan.", image: null, href: "" },
            { title: "5. Pay online", description: "Existing customers can pay installments securely through Pay My Installment.", image: null, href: "/pay-my-installment" },
            { title: "6. Handover & management", description: "After handover our facilities management team continues to care for the property.", image: null, href: "" },
          ],
        }),
        section("faq", { eyebrow: "FAQs", heading: "Investment questions", intro: "", libraryCategory: "investment", items: [], background: "muted" }),
        section("faq", { eyebrow: "", heading: "Payments", intro: "", libraryCategory: "payments", items: [], background: "default" }),
        section("featuredProjects", { eyebrow: "Opportunities", heading: "Projects under construction", intro: "", mode: "latest", category: "RESIDENTIAL", projectIds: [], limit: 3, showAllLink: true, background: "muted" }),
        enquiry("INVESTOR", "Talk to an investment advisor"),
      ],
    },
    {
      slug: "faqs",
      title: "Frequently Asked Questions",
      excerpt: "Answers to common questions about PCI and our projects.",
      sections: [
        section("faq", { eyebrow: "", heading: "General", intro: "", libraryCategory: "general", items: [], background: "default" }),
        section("faq", { eyebrow: "", heading: "Investment", intro: "", libraryCategory: "investment", items: [], background: "muted" }),
        section("faq", { eyebrow: "", heading: "Payments", intro: "", libraryCategory: "payments", items: [], background: "default" }),
      ],
    },
    {
      slug: "channel-partners",
      title: "Channel Partners",
      excerpt: "Work with Premier Choice International.",
      sections: [
        section("richText", {
          eyebrow: "Partner with PCI",
          heading: "Channel partner programme",
          intro: "",
          body: "<p>PCI works with real estate agencies and brokers to bring our projects to buyers and investors. Register your interest below and our partnerships team will contact you with the next steps.</p>",
          width: "narrow",
          background: "default",
        }),
        section("cta", { heading: "Existing partner?", text: "The online partner portal is planned for a later phase. In the meantime, contact our partnerships team for inventory and marketing material.", ctaLabel: "Contact the partners team", ctaHref: "/contact", image: null }),
        enquiry("CHANNEL_PARTNER", "Register as a channel partner"),
      ],
    },
    {
      slug: "careers",
      title: "Life at PCI",
      excerpt: "Build your career with Premier Choice International.",
      sections: [
        section("richText", { eyebrow: "Careers", heading: "Join Premier Choice International", intro: "", body: "<p>We are always interested in hearing from talented people in development, construction, sales, marketing, finance and facilities management. Browse our current vacancies below.</p>", width: "narrow", background: "default" }),
        section("vacancies", { eyebrow: "Open roles", heading: "Current vacancies", intro: "", background: "muted" }),
      ],
    },
    { slug: "contact", title: "Contact Us", excerpt: "We value your feedback and enquiries.", sections: [enquiry("CONTACT", "Send us a message")] },
    {
      slug: "privacy-policy",
      title: "Privacy Policy",
      sections: [section("richText", { eyebrow: "", heading: "", intro: "", body: legalHtml("pages-privacy-policy.txt"), width: "narrow", background: "default" })],
    },
    {
      slug: "terms-conditions",
      title: "Terms & Conditions",
      sections: [section("richText", { eyebrow: "", heading: "", intro: "", body: legalHtml("pages-terms-conditions.txt"), width: "narrow", background: "default" })],
    },
    {
      slug: "cookies",
      title: "Cookie Policy",
      sections: [
        section("richText", {
          eyebrow: "",
          heading: "",
          intro: "",
          width: "narrow",
          background: "default",
          body:
            "<p>This website uses a small number of cookies.</p><h3>Essential cookies</h3><ul><li><strong>pci_consent</strong> — remembers your cookie choice (6 months).</li><li><strong>pci_session</strong> — keeps CMS staff signed in; only set for authorised users.</li></ul><h3>Analytics and advertising cookies</h3><p>Only if you choose “Accept all”, we load Google Tag Manager, which may set Google Analytics and advertising cookies to measure visits and campaign performance. You can change your choice at any time by clearing this site's cookies.</p>",
        }),
      ],
    },
  ];
  for (const p of pages) {
    await db.page.create({
      data: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt ?? "",
        seoDescription: p.seoDescription ?? "",
        sections: p.sections as unknown as Prisma.InputJsonValue,
        status: "PUBLISHED",
        publishedAt: now,
        noindex: p.noindex ?? false,
        authorId: admin.id,
        updatedById: admin.id,
        featuredImageId: p.slug === "home" ? null : homeBanner,
        revisions: { create: { title: p.title, snapshot: { title: p.title, sections: p.sections } as unknown as Prisma.InputJsonValue, note: "Initial content", createdById: admin.id } },
      },
    });
  }

  // ───────── Navigation ─────────
  const menus: Record<string, { label: string; href: string; children?: { label: string; href: string }[] }[]> = {
    header: [
      {
        label: "Projects",
        href: "/projects",
        children: [
          { label: "Residential", href: "/projects?category=residential" },
          { label: "Commercial", href: "/projects?category=commercial" },
          { label: "Mixed Use", href: "/projects?category=mixed-use" },
          { label: "Retail & Malls", href: "/projects?category=retail" },
          { label: "Ongoing", href: "/projects?status=ongoing" },
          { label: "Completed", href: "/projects?status=completed" },
          { label: "Locations", href: "/locations" },
        ],
      },
      { label: "Updates", href: "/project-updates", children: [{ label: "Construction updates", href: "/project-updates" }, { label: "VR tours", href: "/vr-tours" }] },
      { label: "Invest", href: "/invest-with-pci", children: [{ label: "Invest with PCI", href: "/invest-with-pci" }, { label: "FAQs", href: "/faqs" }, { label: "Channel partners", href: "/channel-partners" }] },
      {
        label: "About",
        href: "/about",
        children: [
          { label: "About PCI", href: "/about" },
          { label: "Vision & values", href: "/about/vision-values" },
          { label: "Leadership", href: "/about/leadership" },
          { label: "Our journey", href: "/about/journey" },
          { label: "Partners", href: "/about/partners" },
          { label: "Careers", href: "/careers" },
        ],
      },
      { label: "Media", href: "/media", children: [{ label: "News", href: "/media?category=news" }, { label: "Press releases", href: "/media?category=press-releases" }, { label: "Events", href: "/media?category=events" }, { label: "Insights", href: "/media?category=insights" }] },
      { label: "Contact", href: "/contact" },
    ],
    footer: [
      { label: "All projects", href: "/projects" },
      { label: "Project updates", href: "/project-updates" },
      { label: "Locations", href: "/locations" },
      { label: "Invest with PCI", href: "/invest-with-pci" },
      { label: "About PCI", href: "/about" },
      { label: "News & media", href: "/media" },
      { label: "Careers", href: "/careers" },
      { label: "Channel partners", href: "/channel-partners" },
      { label: "Contact", href: "/contact" },
    ],
    legal: [
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms & conditions", href: "/terms-conditions" },
      { label: "Cookie policy", href: "/cookies" },
    ],
  };
  const names: Record<string, string> = { header: "Main navigation", footer: "Footer links", legal: "Legal links (footer bottom)" };
  for (const [key, items] of Object.entries(menus)) {
    const menu = await db.menu.create({ data: { key, name: names[key] } });
    for (const [order, item] of items.entries()) {
      const parent = await db.menuItem.create({ data: { menuId: menu.id, label: item.label, href: item.href, order } });
      if (item.children?.length) {
        await db.menuItem.createMany({ data: item.children.map((c, k) => ({ menuId: menu.id, parentId: parent.id, label: c.label, href: c.href, order: k })) });
      }
    }
  }

  // ───────── Redirect map from the current WordPress URLs ─────────
  const pageRedirects: [string, string][] = [
    ["/about-us", "/about"],
    ["/our-story", "/about"],
    ["/vision-mission", "/about/vision-values"],
    ["/ceo-message", "/about/leadership"],
    ["/our-initiatives", "/about"],
    ["/testimonials", "/about"],
    ["/contact-us", "/contact"],
    ["/schedule-site-visit", "/contact"],
    ["/development-updates", "/project-updates"],
    ["/news-events", "/media"],
    ["/blog", "/media"],
    ["/360-portfolio", "/vr-tours"],
    ["/home-3", "/"],
    ["/sample-page", "/"],
    ["/sample-page-2", "/"],
    ["/test", "/"],
    ["/box-park-1", "/projects/box-park"],
    ["/roman-grove-2", "/projects/roman-grove-2"],
    ["/roman-grove-1", "/projects/roman-grove-1"],
  ];
  for (const p of projects) if (!["box-park"].includes(p.slug)) pageRedirects.push([`/${p.slug}`, `/projects/${p.slug}`]);
  const all = [...pageRedirects.map(([fromPath, toPath]) => ({ fromPath, toPath, note: "WordPress page migrated" })), ...redirects];
  const seen = new Set<string>();
  for (const r of all) {
    const from = r.fromPath.toLowerCase().replace(/\/+$/, "");
    if (seen.has(from) || from === r.toPath) continue;
    seen.add(from);
    await db.redirect.create({ data: { fromPath: from, toPath: r.toPath, permanent: true, note: r.note } });
  }
  // The pages "/projects", "/faqs", "/privacy-policy", "/terms-conditions" and "/careers" keep their URLs.

  console.log("\nSeed complete.");
  console.log(`  ${projects.length} projects, ${pages.length} pages, ${manifest.posts.length} articles, ${uploaded.size} media files, ${seen.size} redirects`);
  console.log("\nCMS accounts (change these passwords after first sign-in):");
  for (const [role, email, password] of credentials) console.log(`  ${role.padEnd(15)} ${email.padEnd(32)} ${password}`);
}

/** Converts a text dump of a WordPress legal page into simple paragraphs. */
function legalHtml(file: string): string {
  const source = path.resolve("prisma/seed-content", file);
  if (!fs.existsSync(source)) return "<p>This policy is being updated. Please contact info@premierchoiceint.com for details.</p>";
  const lines = fs
    .readFileSync(source, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("DATE:") && l !== "IMAGES:");
  return sanitizeRichText(
    lines
      .map((l) => (l.length < 60 && !/[.,;:]$/.test(l) ? `<h3>${escapeHtml(l)}</h3>` : `<p>${escapeHtml(l)}</p>`))
      .join("")
  );
}

function escapeHtml(s: string) {
  return decode(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

