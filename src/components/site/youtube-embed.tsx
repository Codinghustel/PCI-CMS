"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { track } from "@/lib/analytics-client";
import { cn } from "@/lib/utils";

/**
 * Facade for YouTube: shows a poster and only loads the (privacy-enhanced)
 * player when the visitor presses play, keeping initial page load light.
 */
export function YoutubeEmbed({ videoId, title, poster, className, project }: { videoId: string; title: string; poster?: string | null; className?: string; project?: string }) {
  const [playing, setPlaying] = useState(false);
  const thumb = poster ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden bg-black", className)}>
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setPlaying(true);
            track("video_play", { label: title, project });
          }}
          className="group absolute inset-0 flex items-center justify-center"
          aria-label={`Play video: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube poster, lazy loaded */}
          <img src={thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100" />
          <span className="relative flex size-18 items-center justify-center rounded-full bg-white/95 text-primary shadow-xl transition-transform group-hover:scale-105">
            <Play className="ms-1 size-7 fill-current" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}
