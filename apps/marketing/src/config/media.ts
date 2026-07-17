import type { VideoSource } from "@/components/video/product-video";
import type { VideoGalleryItem } from "@/components/video/video-gallery";

/**
 * Central registry for every demo video on the marketing site.
 *
 * To publish a video, replace a `null` with a VideoSource:
 *
 *   youtube:  { kind: "youtube", id: "dQw4w9WgXcQ" }
 *   vimeo:    { kind: "vimeo", id: "76979871" }
 *   self-hosted mp4:
 *     {
 *       kind: "mp4",
 *       src: "https://cdn.usevoltx.com/demos/ai-agents.mp4",
 *       poster: "https://cdn.usevoltx.com/demos/ai-agents-poster.jpg",
 *       captions: [{ src: "/captions/ai-agents.en.vtt", srcLang: "en", label: "English", default: true }],
 *     }
 *
 * Every consumer degrades correctly while a slot is null: feature
 * sections show only their live animated preview (no "Demo video" tab),
 * and the gallery section stays off the page entirely. Nothing else
 * needs to change to ship a video — edit this file only.
 */
export const demoVideos: Record<
  "productTour" | "aiAutomation" | "crm" | "workflows" | "analytics" | "mobileApp",
  VideoSource | null
> = {
  /** The main "watch the demo" video, linked from the hero. */
  productTour: null,
  aiAutomation: null,
  crm: null,
  workflows: null,
  analytics: null,
  mobileApp: null,
};

/**
 * The "Watch Voltx in action" gallery near the foot of the homepage.
 * Add items as videos are produced; the section renders only when at
 * least one item exists.
 */
export const videoGallery: VideoGalleryItem[] = [];
