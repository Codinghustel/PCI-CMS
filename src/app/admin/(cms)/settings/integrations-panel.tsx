"use client";

import Link from "next/link";
import { BarChart3, CalendarClock, CreditCard, Globe, Inbox, Play, PlugZap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/admin/ui";
import { runLeadDeliveryAction, testBitrixAction } from "@/app/admin/actions/site";
import type { IntegrationState, IntegrationStatus } from "@/server/services/integrations";
import { cn } from "@/lib/utils";

type Serialized<T> = T extends Date ? string : T extends object ? { [K in keyof T]: Serialized<T[K]> } : T;

const STATE: Record<IntegrationState, { label: string; cls: string }> = {
  connected: { label: "Connected", cls: "bg-emerald-100 text-emerald-900" },
  configured: { label: "Configured", cls: "bg-emerald-100 text-emerald-900" },
  attention: { label: "Needs attention", cls: "bg-amber-100 text-amber-900" },
  not_configured: { label: "Not configured", cls: "bg-slate-200 text-slate-700" },
  info: { label: "Information", cls: "bg-sky-100 text-sky-900" },
};

function StateBadge({ state }: { state: IntegrationState }) {
  return <Badge variant="secondary" className={STATE[state].cls}>{STATE[state].label}</Badge>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 text-sm sm:grid-cols-[12rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "—");
const Env = ({ name }: { name: string }) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{name}</code>;

function IntegrationCard({
  icon: Icon,
  title,
  description,
  state,
  children,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  state: IntegrationState;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-5 text-primary" /></span>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <StateBadge state={state} />
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <dl className="divide-y">{children}</dl>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}

/**
 * Settings → Integrations: status, configuration and operations for every
 * external system. Secrets are managed in the hosting environment and only
 * their presence is shown here.
 */
export function IntegrationsPanel({ status, options }: { status: Serialized<IntegrationStatus>; options: React.ReactNode }) {
  const { bitrix, payment, scheduler, indexing, analytics } = status;
  return (
    <div className="space-y-6">
      <p className={cn("rounded-lg border bg-background p-3 text-sm text-muted-foreground")}>
        Secrets such as webhook URLs and signing keys are stored in the hosting environment (never in the CMS database). Ask IT to change them; everything else can be configured here. Remember to <strong>Save settings</strong> after editing options.
      </p>

      <IntegrationCard
        icon={Inbox}
        title="Bitrix24 CRM"
        description="Website enquiries are stored in the CMS first, then delivered to Bitrix24 as leads."
        state={bitrix.state}
        actions={
          <>
            <ActionButton action={testBitrixAction}><PlugZap /> Test connection</ActionButton>
            <ActionButton action={runLeadDeliveryAction}><Play /> Deliver pending leads now</ActionButton>
            <Link href="/admin/leads?crmStatus=FAILED" className="inline-flex h-7 items-center px-2 text-sm text-primary hover:underline">View failed leads</Link>
          </>
        }
      >
        <Row label="Inbound webhook">{bitrix.webhook ? <span className="font-mono text-xs">{bitrix.webhook}</span> : <span>Not set — add <Env name="BITRIX24_WEBHOOK_URL" /></span>}</Row>
        <Row label="Delivery">{bitrix.blockedReason ? <span className="text-amber-700">{bitrix.blockedReason}</span> : "Active — new leads are sent automatically"}</Row>
        <Row label="Project field / responsible">{bitrix.projectField || "—"} · {bitrix.assignee ? `user #${bitrix.assignee}` : "Bitrix24 routing"}</Row>
        <Row label="Leads (last 30 days)">{bitrix.stats.last30}</Row>
        <Row label="Queue">
          <span className={bitrix.stats.failed ? "font-medium text-destructive" : ""}>{bitrix.stats.failed} failed</span> · {bitrix.stats.pending} pending · {bitrix.stats.notConfigured} waiting for configuration
        </Row>
        <Row label="Last successful delivery">{when(bitrix.lastDeliveredAt)}</Row>
      </IntegrationCard>

      <Card>
        <CardHeader className="border-b"><CardTitle className="text-base">Bitrix24 options</CardTitle></CardHeader>
        <CardContent className="p-5">{options}</CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <IntegrationCard
          icon={CalendarClock}
          title="Scheduled job"
          description="Retries failed CRM deliveries and cleans up expired sessions every few minutes."
          state={scheduler.state}
        >
          <Row label="Job token">{scheduler.secretSet ? "Set" : <span>Not set — add <Env name="CRON_SECRET" /></span>}</Row>
          <Row label="Endpoint"><span className="font-mono text-xs">POST /api/cron/deliver-leads</span></Row>
          <Row label="Last run">
            {scheduler.lastRun ? (
              <span>
                {when(scheduler.lastRun.startedAt)} ({scheduler.lastRun.trigger}) —{" "}
                <span className={scheduler.lastRun.success ? "text-emerald-700" : "text-destructive"}>{scheduler.lastRun.success ? "succeeded" : "failed"}</span>
                {scheduler.lastRun.summary ? <span className="block text-xs text-muted-foreground">{scheduler.lastRun.summary}</span> : null}
              </span>
            ) : "Never"}
          </Row>
        </IntegrationCard>

        <IntegrationCard
          icon={CreditCard}
          title="Payment Service"
          description="Separate verified payment service (Track C) behind “Pay My Installment”."
          state={payment.state}
        >
          <Row label="Mode">{payment.mode === "service" ? "Verified online payment hand-off" : "Interim: payment requests go to Finance via Bitrix24"}</Row>
          <Row label="Service URL">{payment.service ? <span className="font-mono text-xs">{payment.service}</span> : <span>Not set — <Env name="PAYMENT_SERVICE_URL" /> + <Env name="PAYMENT_SERVICE_SECRET" /></span>}</Row>
          <Row label="Card data">Never handled by the website — entered only on the provider&apos;s hosted page.</Row>
        </IntegrationCard>

        <IntegrationCard
          icon={Globe}
          title="Search indexing"
          description="Controls whether search engines may index this environment."
          state={indexing.state}
        >
          <Row label="Environment"><span className="capitalize">{indexing.siteEnv}</span> (<Env name="SITE_ENV" />)</Row>
          <Row label="Indexing">{indexing.indexable ? "Allowed — sitemap published" : "Blocked — robots.txt disallows all and pages send noindex"}</Row>
          <Row label="Site URL">{indexing.siteUrl}</Row>
        </IntegrationCard>

        <IntegrationCard
          icon={BarChart3}
          title="Analytics (Google Tag Manager)"
          description="GA4 and advertising tags load through GTM only after visitors accept cookies."
          state={analytics.state}
        >
          <Row label="Container">{analytics.gtmId || "Not set"}</Row>
          <Row label="Configure">Set the container ID in the <strong>Analytics &amp; consent</strong> tab.</Row>
        </IntegrationCard>
      </div>
    </div>
  );
}
