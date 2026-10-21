import Link from "next/link";
import { BookOpen, AlertTriangle, Building2, CalendarClock, FileText, Inbox, Plus, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/ui";
import { requirePermissionPage } from "@/lib/auth/session";
import { getDashboard } from "@/server/services/dashboard";
import { can } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/text";

export default async function DashboardPage() {
  const actor = await requirePermissionPage("dashboard.view");
  const d = await getDashboard();
  const stats = [
    { label: "Published projects", value: d.stats.projectsPublished, sub: `${d.stats.projectsTotal} total`, icon: Building2, href: "/admin/projects" },
    { label: "Published pages", value: d.stats.pagesPublished, sub: `${d.stats.pagesTotal} total`, icon: FileText, href: "/admin/pages" },
    { label: "Construction updates", value: d.stats.updatesPublished, sub: "published", icon: CalendarClock, href: "/admin/updates" },
    { label: "Leads (30 days)", value: d.stats.last30, sub: `${d.stats.failed} failed CRM deliveries`, icon: Inbox, href: "/admin/leads", alert: d.stats.failed > 0 },
  ];
  return (
    <>
      <PageHeader
        title={`Welcome, ${actor.name.split(" ")[0]}`}
        description="Overview of website content, review queue and lead delivery."
        actions={
          <>
            <Button asChild variant="ghost" size="sm"><Link href="/admin/guide"><BookOpen /> User guide</Link></Button>
            {can(actor, "content.writeOwn") ? (
            <>
              <Button asChild variant="outline" size="sm"><Link href="/admin/updates/new"><Plus /> Construction update</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href="/admin/pages"><Plus /> Page</Link></Button>
              <Button asChild size="sm"><Link href="/admin/projects/new"><Plus /> Project</Link></Button>
            </>
            ) : null}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="h-full transition hover:shadow-md">
                <CardContent className="flex items-start justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="mt-1 text-3xl font-semibold">{s.value}</p>
                    <p className={s.alert ? "mt-1 text-xs font-medium text-destructive" : "mt-1 text-xs text-muted-foreground"}>{s.sub}</p>
                  </div>
                  <Icon className="size-5 text-muted-foreground" aria-hidden />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {d.stats.notConfigured > 0 ? (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {d.stats.notConfigured} lead(s) are stored but not sent to Bitrix24 because the CRM webhook is not configured. They will be delivered automatically once it is.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4 text-amber-600" /> Data quality</CardTitle></CardHeader>
          <CardContent>
            {d.warnings.length ? (
              <ul className="divide-y text-sm">
                {d.warnings.slice(0, 10).map((w, i) => (
                  <li key={i} className="py-2.5"><Link href={w.href} className="font-medium hover:underline">{w.name}</Link><p className="text-muted-foreground">{w.message}</p></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No data-quality issues found.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BadgeCheck className="size-4" /> Awaiting review</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {d.review.length === 0 && d.pendingApprovals.length === 0 ? <p className="text-muted-foreground">Nothing is waiting for review.</p> : null}
            {d.review.length ? (
              <ul className="divide-y">
                {d.review.map((r) => (
                  <li key={r.href} className="flex justify-between gap-4 py-2"><Link href={r.href} className="font-medium hover:underline">{r.label}</Link><span className="text-muted-foreground">{r.type}</span></li>
                ))}
              </ul>
            ) : null}
            {d.pendingApprovals.length ? (
              <div>
                <p className="mb-1 font-medium">Commercial details awaiting Sales approval</p>
                <ul className="divide-y">
                  {d.pendingApprovals.map((p) => (
                    <li key={p.id} className="py-2"><Link href={`/admin/projects/${p.id}?tab=commercial`} className="hover:underline">{p.name}</Link></li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recently updated projects</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {d.recentProjects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  <span className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{formatDate(p.updatedAt, "short")}</span><StatusBadge status={p.status} /></span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recently updated pages</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {d.recentPages.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0"><Link href={`/admin/pages/${p.id}`} className="font-medium hover:underline">{p.title}</Link>{p.updatedBy ? <span className="block text-xs text-muted-foreground">by {p.updatedBy.name}</span> : null}</span>
                  <span className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{formatDate(p.updatedAt, "short")}</span><StatusBadge status={p.status} /></span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
