import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
      />
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <SearchX className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-8 text-sm font-medium uppercase tracking-wide text-primary">404</p>
          <h1 className="text-balance mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
            That page is not here
          </h1>
          <p className="text-pretty mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            The link may have changed, or the page may no longer be available. Explore the
            platform or return to the Voltx homepage.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/">Return home</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/features">
                Explore features
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}