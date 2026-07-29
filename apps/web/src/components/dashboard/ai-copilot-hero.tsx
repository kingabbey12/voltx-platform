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
      {/* Ambient gold wash, top-right, echoing the light source the surface
          system already implies. Pointer-events-none so it never intercepts a
          click meant for the CTA. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--primary) / 0.28), transparent 65%)",
        }}
      />

      <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
            <Sparkles className="h-3 w-3" aria-hidden />
            AI Copilot
          </span>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
            Your copilot for <span className="text-gradient-gold">smarter growth</span>
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

        {/* Decorative mark. An <svg> rather than an image so it inherits the
            theme's gold and stays crisp at any density. */}
        <div aria-hidden className="relative hidden shrink-0 md:block">
          <div className="grid h-40 w-40 place-items-center rounded-full border border-primary/20 bg-gradient-to-br from-primary/15 to-transparent">
            <div className="grid h-28 w-28 place-items-center rounded-full border border-primary/30 bg-background/60 backdrop-blur-sm">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
