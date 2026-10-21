"use client";

import { useEffect } from "react";
import { Download, FileText, Lock, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LeadForm } from "@/components/site/lead-form";
import { siteButtonClass } from "@/components/site/site-button";
import { track, type TrackEvent } from "@/lib/analytics-client";

export function TrackView({ event, label, project }: { event: TrackEvent; label?: string; project?: string }) {
  useEffect(() => {
    track(event, { label, project });
  }, [event, label, project]);
  return null;
}

/**
 * Download link for brochures / floor plans. When the document is gated, the
 * visitor completes a short lead form first (delivered to Bitrix24 with the
 * project context) and the link is revealed on success.
 */
export function DocumentDownload({
  title,
  url,
  gated,
  projectId,
  projectName,
  consentText,
  event = "brochure_download",
  variant = "link",
}: {
  title: string;
  url: string;
  gated: boolean;
  projectId: string;
  projectName: string;
  consentText: string;
  event?: TrackEvent;
  /** "hero" = large light-outline button for dark hero banners. */
  variant?: "link" | "button" | "hero";
}) {
  const cls =
    variant === "hero"
      ? siteButtonClass("outline-light", "lg")
      : variant === "button"
        ? siteButtonClass("outline", "md")
        : "inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline";
  if (!gated) {
    return (
      <a href={url} target="_blank" rel="noopener" className={cls} data-track={event} data-track-label={title} data-track-project={projectName}>
        <Download className="size-4" aria-hidden /> {title}
      </a>
    );
  }
  return (
    <Dialog>
      <DialogTrigger className={cls}>
        <Lock className="size-4" aria-hidden /> {title}
      </DialogTrigger>
      <DialogContent className="rounded-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-2xl font-medium">
            <FileText className="size-5 text-accent" aria-hidden /> {title}
          </DialogTitle>
          <DialogDescription>Share your details and we&apos;ll unlock the download straight away.</DialogDescription>
        </DialogHeader>
        <LeadForm
          formType="BROCHURE_REQUEST"
          projectId={projectId}
          projectName={projectName}
          consentText={consentText}
          showMessage={false}
          submitLabel="Unlock download"
          successMessage="Thank you — your download is ready."
          unlockDocument={{ title, url }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Share via the Web Share API, falling back to copying the link. Matches the hero button size. */
export function ShareButton({ title, size = "lg" }: { title: string; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      type="button"
      className={siteButtonClass("outline-light", size)}
      onClick={async () => {
        const url = window.location.href.split("?")[0];
        track("share", { label: title });
        if (typeof navigator.share === "function") {
          try {
            await navigator.share({ title, url });
          } catch {
            /* cancelled */
          }
        } else {
          await navigator.clipboard.writeText(url);
          toast.success("Link copied to clipboard");
        }
      }}
    >
      <Share2 aria-hidden /> Share
    </button>
  );
}
