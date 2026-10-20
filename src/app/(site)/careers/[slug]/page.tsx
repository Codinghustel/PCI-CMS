import { Suspense } from "react";
import { RouteFallback } from "@/components/site/route-fallback";
import type { Metadata } from "next";
import { Briefcase, CalendarDays, MapPin } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { ApplicationForm } from "@/components/site/application-form";
import { getPublicSettings, getPublishedVacancy, publishedSlugs } from "@/server/public-data";
import { buildMetadata, redirectOrNotFound } from "@/lib/seo";
import { formatDate } from "@/lib/text";
import { sanitizeRichText } from "@/lib/sanitize";

export async function generateStaticParams() {
  const slugs = await publishedSlugs("vacancies");
  return (slugs.length ? slugs : ["__none__"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const v = await getPublishedVacancy(slug);
  if (!v) return { title: "Vacancy not found", robots: { index: false } };
  return buildMetadata({ title: `${v.title} — Careers`, description: v.summary, path: `/careers/${v.slug}` });
}

async function VacancyPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [v, { settings }] = await Promise.all([getPublishedVacancy(slug), getPublicSettings()]);
  if (!v) return redirectOrNotFound(`/careers/${slug}`);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "JobPosting",
          title: v.title,
          description: v.description || v.summary,
          datePosted: v.publishedAt?.toISOString(),
          ...(v.closesAt ? { validThrough: v.closesAt.toISOString() } : {}),
          employmentType: v.employmentType?.toUpperCase().replace(/[\s-]+/g, "_"),
          hiringOrganization: { "@type": "Organization", name: settings.general.siteName },
          jobLocation: { "@type": "Place", address: v.location },
        }}
      />
      <PageHero eyebrow={v.department || "Careers"} title={v.title} intro={v.summary} crumbs={[{ name: "Careers", path: "/careers" }, { name: v.title, path: `/careers/${v.slug}` }]} />
      <section className="section-y">
        <div className="container-site grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ul className="mb-8 flex flex-wrap gap-6 border-y border-border py-4 text-sm">
              {v.location ? <li className="flex items-center gap-2"><MapPin className="size-4 text-accent" aria-hidden />{v.location}</li> : null}
              {v.employmentType ? <li className="flex items-center gap-2"><Briefcase className="size-4 text-accent" aria-hidden />{v.employmentType}</li> : null}
              {v.closesAt ? <li className="flex items-center gap-2"><CalendarDays className="size-4 text-accent" aria-hidden />Closes {formatDate(v.closesAt)}</li> : null}
            </ul>
            <div className="prose-cms" dangerouslySetInnerHTML={{ __html: sanitizeRichText(v.description) }} />
          </div>
          <aside className="h-fit border border-border p-6 lg:sticky lg:top-28">
            <h2 className="mb-6 text-3xl">Apply for this role</h2>
            {v.isOpen ? <ApplicationForm vacancyId={v.id} /> : <p className="text-sm text-muted-foreground">Applications for this role have closed.</p>}
          </aside>
        </div>
      </section>
    </>
  );
}

// Params are read inside Suspense so the route always has a static shell;
// the proxy has already returned real 404/301 statuses for unknown or moved URLs.
export default function VacancyPage(props: Parameters<typeof VacancyPageContent>[0]) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <VacancyPageContent {...props} />
    </Suspense>
  );
}
