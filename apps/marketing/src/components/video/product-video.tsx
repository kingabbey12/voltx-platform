"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VideoCaptionTrack {
  /** URL of a WebVTT file. */
  src: string;
  srcLang: string;
  label: string;
  default?: boolean;
}

/**
 * One place to describe a demo video regardless of where it's hosted.
 * Self-hosted MP4s get a native <video> (captions via WebVTT tracks,
 * native fullscreen); YouTube/Vimeo get a lazy click-to-load facade so
 * no third-party iframe JS executes until the visitor actually asks for
 * the video — the facade is a plain poster + play button, which is what
 * keeps LCP/TBT clean on video-heavy pages.
 */
export type VideoSource =
  | {
      kind: "mp4";
      src: string;
      poster?: string;
      captions?: VideoCaptionTrack[];
    }
  | { kind: "youtube"; id: string; startAt?: number }
  | { kind: "vimeo"; id: string };

export interface ProductVideoProps {
  source: VideoSource;
  /** Accessible name for the video and its play control. */
  title: string;
  /**
   * Ambient mode: muted, looping, autoplays while on screen and pauses
   * off screen — for silent UI demo loops, not narrated videos. Ignored
   * for YouTube/Vimeo (embeds always wait for a click) and disabled
   * automatically when the visitor prefers reduced motion.
   */
  ambient?: boolean;
  className?: string;
  /** 16:9 by default; pass e.g. "aspect-[4/3]" to override. */
  aspectClassName?: string;
}

function youTubePoster(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function embedUrl(source: Extract<VideoSource, { kind: "youtube" | "vimeo" }>): string {
  if (source.kind === "youtube") {
    const start = source.startAt ? `&start=${source.startAt}` : "";
    // nocookie host + cc_load_policy so provider-side captions are on by default.
    return `https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&rel=0&cc_load_policy=1${start}`;
  }
  return `https://player.vimeo.com/video/${source.id}?autoplay=1`;
}

export function ProductVideo({
  source,
  title,
  ambient = false,
  className,
  aspectClassName = "aspect-video",
}: ProductVideoProps) {
  const prefersReducedMotion = useReducedMotion();

  const frame = cn(
    "group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-card",
    aspectClassName,
    className,
  );

  if (source.kind === "mp4") {
    return (
      <Mp4Video
        source={source}
        title={title}
        ambient={ambient && !prefersReducedMotion}
        className={frame}
      />
    );
  }

  return <EmbedFacade source={source} title={title} className={frame} />;
}

function Mp4Video({
  source,
  title,
  ambient,
  className,
}: {
  source: Extract<VideoSource, { kind: "mp4" }>;
  title: string;
  ambient: boolean;
  className: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Ambient loops play only while visible; pausing off screen keeps the
  // main thread and decoder idle for the rest of the page.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ambient) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          video.play().catch(() => {
            // Autoplay can be blocked by the browser; controls remain usable.
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [ambient]);

  return (
    <div className={className}>
      {/*
        preload="none" + poster keeps the network quiet until the video is
        actually played (ambient loops start fetching on first
        intersection since play() triggers the load).
      */}
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        preload="none"
        poster={source.poster}
        controls={!ambient}
        muted={ambient}
        loop={ambient}
        playsInline
        aria-label={title}
        crossOrigin={source.captions?.length ? "anonymous" : undefined}
      >
        <source src={source.src} type="video/mp4" />
        {source.captions?.map((track) => (
          <track
            key={track.src}
            kind="captions"
            src={track.src}
            srcLang={track.srcLang}
            label={track.label}
            default={track.default}
          />
        ))}
      </video>
    </div>
  );
}

function EmbedFacade({
  source,
  title,
  className,
}: {
  source: Extract<VideoSource, { kind: "youtube" | "vimeo" }>;
  title: string;
  className: string;
}) {
  const [activated, setActivated] = useState(false);
  const activate = useCallback(() => setActivated(true), []);

  if (activated) {
    return (
      <div className={className}>
        <iframe
          className="h-full w-full"
          src={embedUrl(source)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={activate}
      className={cn(className, "cursor-pointer text-left")}
      aria-label={`Play video: ${title}`}
    >
      {source.kind === "youtube" ? (
        /* Poster comes straight from YouTube's image CDN — no iframe, no
           player JS, until the visitor clicks. Vimeo has no unauthenticated
           poster URL scheme, so its facade is a branded gradient instead. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={youTubePoster(source.id)}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-primary/15 via-card to-accent/10"
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-background/70 text-primary shadow-[0_0_40px_-8px_hsl(var(--primary)/0.8)] backdrop-blur-md transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110">
          <Play className="ml-0.5 h-6 w-6" fill="currentColor" />
        </span>
      </span>
      <span className="absolute bottom-4 left-5 right-5 line-clamp-1 text-sm font-medium text-foreground/90">
        {title}
      </span>
    </button>
  );
}
