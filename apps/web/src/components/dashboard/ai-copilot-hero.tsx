"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * The dashboard's statement of identity.
 *
 * Voltx is an AI business operating system, but nothing above the fold said so
 * — the page opened with four counters and a broken panel. This is the one
 * element that makes the product's premise obvious in the first second.
 *
 * Deliberately not data-driven. It is a doorway, not a readout, so it has no
 * loading state and cannot fail. The sections below carry the numbers.
 */
export function AiCopilotHero() {
  return (
    <Card variant="raised" className="glow-primary relative overflow-hidden">
      {/* Three layers rather than one wash: a warm bloom top-right, a cooler
          counter-bloom bottom-left to stop the card reading as a single flat
          tint, and a faint grid that gives the surface texture at close range
          without being legible as a pattern. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full opacity-70 blur-3xl"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary) / 0.30), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full opacity-50 blur-3xl"
        style={{
          background: "radial-gradient(circle, hsl(268 83% 68% / 0.18), transparent 68%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0 0% 100% / 0.025) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100% / 0.025) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(80% 80% at 70% 0%, black, transparent 75%)",
        }}
      />

      <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
            <Sparkles className="h-3 w-3" aria-hidden />
            AI Copilot
          </span>

          <h2 className="mt-4 text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.02em] md:text-4xl">
            Your copilot for
            <br className="hidden sm:block" />
            <span className="text-gradient-gold">smarter growth</span>
          </h2>

          <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
            Ask questions about your pipeline, draft follow-ups, and automate the work
            between deals — grounded in your own CRM data, not generic answers.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/ai">
                <Sparkles className="h-4 w-4" aria-hidden />
                Ask AI Copilot
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/ai/workflows">
                Automate a workflow
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        {/* Decorative mark, built from layered elements rather than an image so
            it inherits the theme's gold and stays crisp at any density. */}
        <div aria-hidden className="relative hidden shrink-0 md:block">
          <div className="motion-safe:animate-float">
            {/* Concentric rings falling off in opacity read as depth; a single
                ring reads as a border. */}
            <div className="grid h-44 w-44 place-items-center rounded-full border border-primary/[0.12] bg-gradient-to-br from-primary/[0.10] via-transparent to-transparent">
              <div className="grid h-32 w-32 place-items-center rounded-full border border-primary/20 bg-gradient-to-br from-primary/[0.14] to-transparent">
                <div className="grid h-20 w-20 place-items-center rounded-full border border-primary/30 bg-background/70 shadow-[0_0_40px_-8px_hsl(var(--primary)/0.5)] backdrop-blur-sm">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
