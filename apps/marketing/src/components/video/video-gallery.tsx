"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { ProductVideo, type VideoSource } from "@/components/video/product-video";

export interface VideoGalleryItem {
  source: VideoSource;
  title: string;
  description?: string;
  /** Poster shown on the gallery card (YouTube items fall back to the YouTube thumbnail). */
  poster?: string;
  duration?: string;
}

/**
 * A responsive grid of demo videos. Cards are pure poster facades —
 * nothing video-related loads until a card is opened — and playback
 * happens in a native <dialog> lightbox, which gives us focus trapping,
 * Escape-to-close, and ::backdrop without any dialog library.
 */
export function VideoGallery({
  items,
  className,
}: {
  items: VideoGalleryItem[];
  className?: string;
}) {
  const [active, setActive] = useState<VideoGalleryItem | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active && !dialog.open) {
      dialog.showModal();
    }
  }, [active]);

  return (
    <div className={className}>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.title}>
            <button
              type="button"
              onClick={() => setActive(item)}
              className="group block w-full text-left"
              aria-label={`Play video: ${item.title}`}
            >
              <span className="relative block aspect-video overflow-hidden rounded-2xl border border-white/10 bg-card">
                <GalleryPoster item={item} />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-background/70 text-primary backdrop-blur-md transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110">
                    <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
                  </span>
                </span>
                {item.duration ? (
                  <span className="absolute bottom-3 right-3 rounded-md bg-background/80 px-2 py-0.5 font-mono text-xs text-foreground/90 backdrop-blur">
                    {item.duration}
                  </span>
                ) : null}
              </span>
              <span className="mt-3 block text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                {item.title}
              </span>
              {item.description ? (
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setActive(null)}
        onClick={(event) => {
          // Clicking the ::backdrop registers on the dialog element itself.
          if (event.target === dialogRef.current) close();
        }}
        className="w-[min(96vw,64rem)] rounded-2xl border border-white/10 bg-background p-0 shadow-2xl backdrop:bg-background/80 backdrop:backdrop-blur-sm"
        aria-label={active ? active.title : undefined}
      >
        {active ? (
          <div className="relative">
            <ProductVideo source={active.source} title={active.title} className="rounded-2xl" />
            <button
              type="button"
              onClick={close}
              aria-label="Close video"
              className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-background text-foreground shadow-lg transition-colors hover:text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}

function GalleryPoster({ item }: { item: VideoGalleryItem }) {
  const poster =
    item.poster ??
    (item.source.kind === "youtube"
      ? `https://i.ytimg.com/vi/${item.source.id}/hqdefault.jpg`
      : item.source.kind === "mp4"
        ? item.source.poster
        : undefined);

  if (!poster) {
    return (
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-primary/15 via-card to-accent/10"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={poster}
      alt=""
      loading="lazy"
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
    />
  );
}
