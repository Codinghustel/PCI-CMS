import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Building2, CalendarClock, CheckCircle2, CreditCard, FileText, MapPin, Navigation, Phone } from "lucide-react";
import { MediaImage } from "@/components/site/media-image";
import { SectionHeading, SectionShell } from "@/components/site/section-shell";
import { SiteButtonLink, siteButtonClass } from "@/components/site/site-button";
import { Gallery } from "@/components/site/gallery";
import { YoutubeEmbed } from "@/components/site/youtube-embed";
import { VrTourGrid } from "@/components/site/vr-tour-viewer";
import { LeadForm } from "@/components/site/lead-form";
import { ProjectCard } from "@/components/site/cards";
import { DocumentDownload, ShareButton, TrackView } from "@/components/site/project-widgets";
import { JsonLd } from "@/components/site/json-ld";
import type { PublicProject } from "@/server/public-data";
import type { SiteSettings } from "@/lib/settings";
import { mapEmbedUrl, telLink, whatsappLink } from "@/lib/settings";
import {
  CONSTRUCTION_STATUS_LABELS,
  DOCUMENT_KIND_LABELS,
  MARKET_LABELS,
  PROJECT_CATEGORY_LABELS,
} from "@/lib/content-labels";
import { formatDate, formatPrice } from "@/lib/text";
import { sanitizeRichText } from "@/lib/sanitize";
import { siteUrl } from "@/lib/env";

export function ProjectDetail({ project: p, settings }: { project: PublicProject; settings: SiteSettings }) {
  const facts: { label: string; value: string }[] = [
    { label: "Type", value: PROJECT_CATEGORY_LABELS[p.category] },
    { label: "Status", value: CONSTRUCTION_STATUS_LABELS[p.constructionStatus] },
    ...(p.commercial.price ? [{ label: "Starting from", value: formatPrice(p.commercial.price.amount, p.commercial.price.currency) }] : []),
    ...(p.commercial.handover ? [{ label: "Handover", value: p.commercial.handover }] : []),
    ...p.keyFacts,
  ];
  const wa = whatsappLink(settings, `I'm interested in ${p.name}.`);
  const tel = telLink(settings.contact.phone);
  const mapQuery = p.latitude != null && p.longitude != null ? `${p.latitude},${p.longitude}` : [p.address, p.city].filter(Boolean).join(", ");
  const map = mapEmbedUrl(mapQuery);
  const brochure = p.documents.find((d) => d.kind === "BROCHURE");
  const hasCommercial = !!(p.commercial.paymentPlan.length || p.commercial.paymentPlanSummary);

  const nav = [
    { id: "overview", label: "Overview" },
    p.unitTypes.length ? { id: "units", label: "Units" } : null,
    p.gallery.length || p.videos.length ? { id: "gallery", label: "Gallery" } : null,
    p.amenities.length ? { id: "amenities", label: "Amenities" } : null,
    p.vrTours.length ? { id: "vr", label: "VR tours" } : null,
    p.floorPlans.length ? { id: "floor-plans", label: "Floor plans" } : null,
    { id: "location", label: "Location" },
    hasCommercial ? { id: "payment-plan", label: "Payment plan" } : null,
    p.latestUpdate ? { id: "progress", label: "Progress" } : null,
    { id: "enquire", label: "Enquire" },
  ].filter((x): x is { id: string; label: string } => !!x);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: p.name,
    description: p.tagline || undefined,
    url: siteUrl(`/projects/${p.slug}`),
    address: { "@type": "PostalAddress", streetAddress: p.address || undefined, addressLocality: p.city, addressCountry: MARKET_LABELS[p.market] },
    ...(p.latitude != null && p.longitude != null ? { geo: { "@type": "GeoCoordinates", latitude: p.latitude, longitude: p.longitude } } : {}),
    ...(p.heroImage ? { image: siteUrl(p.heroImage.url) } : {}),
  };

  return (
    <>
      <TrackView event="project_view" project={p.name} />
      <JsonLd data={jsonLd} />

      {/* Hero */}
      <section className="on-dark relative flex min-h-[80svh] items-end overflow-hidden bg-dark text-white">
        <MediaImage media={p.heroImage} alt={p.heroImage?.alt || p.name} fill priority sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/25" />
        <div className="container-site relative pt-36 pb-14 md:pb-20">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-white/70">
            <Link href="/" className="hover:text-accent">Home</Link> / <Link href="/projects" className="hover:text-accent">Projects</Link> / <span aria-current="page">{p.name}</span>
          </nav>
          <p className="eyebrow mb-4">{PROJECT_CATEGORY_LABELS[p.category]} · {CONSTRUCTION_STATUS_LABELS[p.constructionStatus]}</p>
          <h1 className="text-5xl md:text-7xl">{p.name}</h1>
          <p className="mt-4 flex items-center gap-2 text-white/85"><MapPin className="size-4" aria-hidden />{[p.address, p.city].filter(Boolean).join(", ")}</p>
          {p.tagline ? <p className="mt-5 max-w-2xl text-lg text-white/85">{p.tagline}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#enquire" className={siteButtonClass("accent", "lg")}>Enquire now</a>
            {brochure ? (
              <DocumentDownload title="Download brochure" url={brochure.media.url} gated={brochure.gated} projectId={p.id} projectName={p.name} consentText={settings.forms.consentText} variant="button" />
            ) : null}
            {settings.payment.enabled ? (
              <Link href="/pay-my-installment" data-track="pay_installment_click" data-track-label="project_hero" data-track-project={p.name} className={siteButtonClass("outline-light", "lg")}>
                <CreditCard aria-hidden /> {settings.payment.buttonLabel || "Pay My Installment"}
              </Link>
            ) : null}
            <ShareButton title={p.name} />
          </div>
        </div>
      </section>

      {/* In-page navigation */}
      <nav aria-label="Project sections" className="sticky top-20 z-30 border-b border-border bg-background/95 backdrop-blur">
        <ul className="container-site flex gap-1 overflow-x-auto py-1 text-xs font-semibold tracking-[0.14em] whitespace-nowrap uppercase">
          {nav.map((n) => (
            <li key={n.id}><a href={`#${n.id}`} className="block px-3 py-3 text-muted-foreground hover:text-primary">{n.label}</a></li>
          ))}
        </ul>
      </nav>

      {/* Key facts */}
      <section aria-label="Key facts" className="border-b border-border bg-secondary">
        <dl className="container-site grid grid-cols-2 gap-6 py-10 md:grid-cols-3 lg:grid-cols-6">
          {facts.slice(0, 12).map((f) => (
            <div key={f.label}>
              <dt className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">{f.label}</dt>
              <dd className="heading mt-1.5 text-2xl text-secondary-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
        {p.commercial.approved && p.commercial.asOf && (p.commercial.price || p.commercial.handover) ? (
          <p className="container-site pb-6 text-xs text-muted-foreground">
            Prices and handover dates are indicative as of {formatDate(p.commercial.asOf)} and subject to availability and change. Please confirm with our sales team.
          </p>
        ) : null}
      </section>

      {/* Overview */}
      <SectionShell id="overview">
        <div className="container-site grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="eyebrow mb-4">Overview</p>
            <h2 className="mb-8 text-4xl md:text-5xl">About {p.name}</h2>
            <div className="prose-cms" dangerouslySetInnerHTML={{ __html: sanitizeRichText(p.overview) }} />
          </div>
          <aside className="space-y-6">
            {(p.compliance.dldPermitNumber || p.compliance.dldQr) && (
              <div className="border border-border p-6">
                <p className="eyebrow mb-3">Regulatory information</p>
                {p.compliance.dldPermitNumber ? <p className="text-sm">DLD advertising permit no.: <strong>{p.compliance.dldPermitNumber}</strong></p> : null}
                {p.compliance.dldQr ? (
                  <Image src={p.compliance.dldQr.url} alt={`DLD permit QR code for ${p.name}`} width={160} height={160} className="mt-4 size-40 object-contain" />
                ) : null}
              </div>
            )}
            {p.compliance.regulatoryApprovals ? (
              <div className="border border-border p-6">
                <p className="eyebrow mb-3">Approvals</p>
                <p className="text-sm whitespace-pre-line">{p.compliance.regulatoryApprovals}</p>
              </div>
            ) : null}
            <div className="bg-primary p-6 text-primary-foreground">
              <p className="heading text-2xl">Speak to our sales team</p>
              <div className="mt-5 grid gap-3">
                <a href="#enquire" className={siteButtonClass("accent", "md")}>Enquire</a>
                {tel ? <a href={tel} data-track="call_click" data-track-project={p.name} className={siteButtonClass("outline-light", "md")}><Phone aria-hidden /> Call</a> : null}
                {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" data-track="whatsapp_click" data-track-project={p.name} className={siteButtonClass("outline-light", "md")}>WhatsApp</a> : null}
              </div>
            </div>
          </aside>
        </div>
      </SectionShell>

      {p.unitTypes.length ? (
        <SectionShell id="units" background="muted">
          <div className="container-site">
            <SectionHeading eyebrow="The offering" heading="Units & spaces" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {p.unitTypes.map((u) => (
                <li key={u.name} className="border border-border bg-card p-6">
                  <Building2 className="mb-4 size-6 text-accent" aria-hidden />
                  <h3 className="text-2xl">{u.name}</h3>
                  {u.size ? <p className="mt-1 text-sm font-semibold">{u.size}</p> : null}
                  {u.details ? <p className="mt-2 text-sm text-muted-foreground">{u.details}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </SectionShell>
      ) : null}

      {p.gallery.length || p.videos.length ? (
        <SectionShell id="gallery">
          <div className="container-site space-y-12">
            <SectionHeading eyebrow="Gallery & film" heading="Experience the project" className="mb-0!" />
            {p.videos.length ? (
              <div className={p.videos.length > 1 ? "grid gap-6 md:grid-cols-2" : ""}>
                {p.videos.map((v) => <YoutubeEmbed key={v.youtubeId} videoId={v.youtubeId} title={v.title} project={p.name} />)}
              </div>
            ) : null}
            <Gallery images={p.gallery.map((g) => ({ ...g.media, caption: g.caption }))} layout="mosaic" />
          </div>
        </SectionShell>
      ) : null}

      {p.amenities.length ? (
        <SectionShell id="amenities" background="dark">
          <div className="container-site">
            <SectionHeading eyebrow="Lifestyle" heading="Amenities & facilities" />
            <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {p.amenities.map((a) => (
                <li key={a.name} className="flex gap-3">
                  <CheckCircle2 className="mt-1 size-5 shrink-0 text-accent" aria-hidden />
                  <div>
                    <p className="font-semibold">{a.name}</p>
                    {a.description ? <p className="mt-1 text-sm opacity-75">{a.description}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </SectionShell>
      ) : null}

      {/* VR — rendered only when the project has active tours. */}
      {p.vrTours.length ? (
        <SectionShell id="vr">
          <div className="container-site">
            <SectionHeading eyebrow="Virtual experience" heading="VR & 360° tours" intro="Explore the spaces from anywhere. Tours open full screen and work on desktop, tablet and mobile." />
            <VrTourGrid tours={p.vrTours.map((t) => ({ ...t, image: t.thumbnail ?? p.heroImage, projectName: p.name }))} enquireHref="#enquire" />
          </div>
        </SectionShell>
      ) : null}

      {p.floorPlans.length ? (
        <SectionShell id="floor-plans" background="muted">
          <div className="container-site">
            <SectionHeading eyebrow="Layouts" heading="Floor plans" />
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {p.floorPlans.map((f) => (
                <li key={f.id} className="flex flex-col border border-border bg-card">
                  {f.image && !f.gated ? (
                    <a href={f.image.url} target="_blank" rel="noopener" data-track="floor_plan_view" data-track-label={f.title} data-track-project={p.name} className="relative block aspect-[4/3] bg-white">
                      <Image src={f.image.url} alt={f.image.alt || f.title} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-contain p-4" />
                    </a>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-white text-muted-foreground"><FileText className="size-10" aria-hidden /></div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <h3 className="text-xl">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{[f.unitType, f.size].filter(Boolean).join(" · ")}</p>
                    {f.document || (f.image && f.gated) ? (
                      <DocumentDownload
                        title={f.document ? "Download PDF" : "View floor plan"}
                        url={(f.document ?? f.image)!.url}
                        gated={f.gated}
                        projectId={p.id}
                        projectName={p.name}
                        consentText={settings.forms.consentText}
                        event="floor_plan_view"
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </SectionShell>
      ) : null}

      <SectionShell id="location">
        <div className="container-site grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Location" heading={p.city} intro={p.address} />
            {p.connectivity.length ? (
              <ul className="divide-y divide-border border-y border-border">
                {p.connectivity.map((c) => (
                  <li key={c.place} className="flex items-center justify-between gap-4 py-4 text-sm">
                    <span className="flex items-center gap-2"><Navigation className="size-4 text-accent" aria-hidden />{c.place}</span>
                    <span className="font-semibold">{c.distance}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {p.location ? (
              <Link href={`/locations/${p.location.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                About {p.location.name} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            ) : null}
          </div>
          {map ? <iframe title={`Map showing ${p.name}`} src={map} loading="lazy" className="aspect-[4/3] w-full border-0" referrerPolicy="no-referrer-when-downgrade" /> : null}
        </div>
      </SectionShell>

      {hasCommercial ? (
        <SectionShell id="payment-plan" background="muted">
          <div className="container-site max-w-4xl">
            <SectionHeading eyebrow="Payment plan" heading={p.commercial.paymentPlanSummary || "Payment structure"} />
            {p.commercial.paymentPlan.length ? (
              <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {p.commercial.paymentPlan.map((step, i) => (
                  <li key={i} className="border border-border bg-card p-6">
                    {step.percentage != null ? <p className="heading text-5xl text-primary">{step.percentage}%</p> : null}
                    <p className="mt-2 font-semibold">{step.milestone}</p>
                    {step.note ? <p className="mt-1 text-sm text-muted-foreground">{step.note}</p> : null}
                  </li>
                ))}
              </ol>
            ) : null}
            {p.commercial.asOf ? (
              <p className="mt-6 text-xs text-muted-foreground">Payment plan as of {formatDate(p.commercial.asOf)}. Indicative only and subject to the sale and purchase agreement.</p>
            ) : null}
          </div>
        </SectionShell>
      ) : null}

      {p.latestUpdate ? (
        <SectionShell id="progress">
          <div className="container-site grid items-center gap-10 md:grid-cols-2">
            <div className="relative aspect-video overflow-hidden">
              <MediaImage media={p.latestUpdate.image} alt={p.latestUpdate.image?.alt || p.latestUpdate.title} fill sizes="(min-width: 768px) 50vw, 100vw" />
            </div>
            <div>
              <p className="eyebrow mb-3 flex items-center gap-2"><CalendarClock className="size-4" aria-hidden /> Construction update · {formatDate(p.latestUpdate.date, "month")}</p>
              <h2 className="text-4xl">{p.latestUpdate.title}</h2>
              {p.latestUpdate.progressPercent != null ? (
                <div className="mt-6">
                  <div className="mb-2 flex justify-between text-sm"><span>Overall progress</span><span className="font-semibold">{p.latestUpdate.progressPercent}%</span></div>
                  <div className="h-2 bg-muted" role="progressbar" aria-valuenow={p.latestUpdate.progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Construction progress">
                    <div className="h-full bg-accent" style={{ width: `${p.latestUpdate.progressPercent}%` }} />
                  </div>
                </div>
              ) : null}
              {p.latestUpdate.summary ? <p className="mt-5 text-muted-foreground">{p.latestUpdate.summary}</p> : null}
              <div className="mt-8 flex flex-wrap gap-3">
                <SiteButtonLink href={`/project-updates/${p.latestUpdate.slug}`}>Read update</SiteButtonLink>
                {p.updateCount > 1 ? <SiteButtonLink href={`/project-updates?project=${p.slug}`} variant="outline">All {p.updateCount} updates</SiteButtonLink> : null}
              </div>
            </div>
          </div>
        </SectionShell>
      ) : null}

      {p.documents.length ? (
        <section aria-label="Downloads" className="border-y border-border bg-secondary">
          <div className="container-site flex flex-wrap items-center gap-x-8 gap-y-4 py-8">
            <p className="eyebrow">Downloads</p>
            {p.documents.map((d) => (
              <DocumentDownload key={d.id} title={d.title || DOCUMENT_KIND_LABELS[d.kind]} url={d.media.url} gated={d.gated} projectId={p.id} projectName={p.name} consentText={settings.forms.consentText} />
            ))}
          </div>
        </section>
      ) : null}

      <SectionShell id="enquire" background="dark">
        <div className="container-site grid gap-12 lg:grid-cols-2">
          <SectionHeading eyebrow="Register your interest" heading={`Enquire about ${p.name}`} intro="Share your details and a PCI sales advisor will contact you with availability, pricing and the latest payment plan." />
          <LeadForm
            formType="PROJECT_ENQUIRY"
            projectId={p.id}
            projectName={p.name}
            consentText={settings.forms.consentText}
            successMessage={settings.forms.successMessage}
            showCountry
            tone="dark"
          />
        </div>
      </SectionShell>

      {p.related.length ? (
        <SectionShell>
          <div className="container-site">
            <SectionHeading eyebrow="You may also like" heading="Related projects" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {p.related.slice(0, 3).map((r) => <ProjectCard key={r.id} project={r} />)}
            </div>
          </div>
        </SectionShell>
      ) : null}
    </>
  );
}
