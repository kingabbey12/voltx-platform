import { ArrowRight, MonitorPlay, Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { InteractiveDemo, type DemoPane } from "@/components/video/interactive-demo";
import { ProductVideo, type VideoSource } from "@/components/video/product-video";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export interface ShowcaseStep {
  title: string;
  description: string;
}

export interface FeatureShowcaseProps {
  /** Anchor id so nav / in-page links can target the section. */
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  steps: ShowcaseStep[];
  /** The live animated preview demonstrating the feature. */
  preview: ReactNode;
  /**
   * Optional produced demo video (from src/config/media.ts). When
   * present it becomes a second "Demo video" tab in the See-it-in-action
   * pane; when null the section simply shows the live preview.
   */
  video?: VideoSource | null;
  /** Flip the copy/media columns on desktop. */
  reverse?: boolean;
  /** Where "Try it now" sends the visitor (defaults to the app). */
  ctaHref?: string;
  ctaLabel?: string;
}

/**
 * The homepage's per-feature section: positioning copy and a numbered
 * step-by-step on one side, a "See it in action" pane (live preview +
 * optional demo video) on the other, and a try-it CTA. One component so
 * every feature on the page keeps identical rhythm and spacing.
 */
export function FeatureShowcase({
  id,
  icon: Icon,
  eyebrow,
  title,
  description,
  steps,
  preview,
  video = null,
  reverse = false,
  ctaHref = siteConfig.appUrl,
  ctaLabel = "Try Voltx free",
}: FeatureShowcaseProps) {
  const panes: DemoPane[] = [
    { label: "Live preview", icon: <Sparkles className="h-4 w-4" />, content: preview },
    ...(video
      ? [
          {
            label: "Demo video",
            icon: <MonitorPlay className="h-4 w-4" />,
            content: (
              <div className="flex h-full items-center justify-center p-4">
                <ProductVideo source={video} title={`${title} demo`} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <section id={id} className="relative scroll-mt-24 py-16 sm:py-24">
      <div className="container">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal className={cn(reverse && "lg:order-2")}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
              <Icon className="h-3.5 w-3.5" />
              {eyebrow}
            </span>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h2>
            <p className="text-pretty mt-4 text-lg leading-relaxed text-muted-foreground">
              {description}
            </p>

            <ol className="mt-8 flex flex-col gap-5">
              {steps.map((step, index) => (
                <li key={step.title} className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-mono text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild>
                <a href={ctaHref}>
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </Button>
              <Button variant="ghost" asChild>
                <a href="/contact">Talk to sales</a>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1} className={cn("min-w-0", reverse && "lg:order-1")}>
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-primary/15 blur-3xl"
              />
              <InteractiveDemo panes={panes} ariaLabel={`${title} — see it in action`} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
