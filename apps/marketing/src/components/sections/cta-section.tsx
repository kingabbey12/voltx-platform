import { ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/config/site";

interface CtaSectionProps {
  title?: string;
  description?: string;
}

export function CtaSection({
  title = "Ready to run your business on Voltx?",
  description = "Start free in minutes, or talk to our team about your rollout.",
}: CtaSectionProps) {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[30rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[130px]" />
      </div>
      <div className="container">
        <Reveal>
          <div className="shimmer-border relative mx-auto flex max-w-4xl flex-col items-center gap-6 overflow-hidden rounded-3xl border border-white/10 bg-card/60 px-6 py-16 text-center backdrop-blur-xl sm:px-16">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
              {title}
            </h2>
            <p className="text-pretty max-w-xl text-lg text-muted-foreground">{description}</p>
            <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <a href={siteConfig.appUrl}>
                  Start Free
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="/contact">
                  <Calendar className="h-4 w-4" />
                  Book Demo
                </a>
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
