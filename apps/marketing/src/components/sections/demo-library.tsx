import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { VideoGallery } from "@/components/video/video-gallery";
import { videoGallery } from "@/config/media";

/**
 * "Watch Voltx in action" — the produced-video library. Driven entirely
 * by src/config/media.ts: while no videos are published the section
 * contributes nothing to the page (no empty state, no placeholder), and
 * it appears automatically once the first gallery item is added.
 */
export function DemoLibrary() {
  if (videoGallery.length === 0) return null;

  return (
    <section id="demos" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <SectionEyebrow>Demo library</SectionEyebrow>
          <Reveal delay={0.05}>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
              Watch Voltx in action
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mt-5 text-lg leading-relaxed text-muted-foreground">
              Short, real walkthroughs — no slideware, just the product doing the work.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="mt-14">
          <VideoGallery items={videoGallery} />
        </Reveal>
      </div>
    </section>
  );
}
