import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";

// No real usage metrics exist yet for this product — showing "Coming Soon"
// for each rather than inventing numbers. Replace these labels' values with
// real, measured data (and remove this comment) once it's available.
const platformStats = [
  { value: "Coming Soon", label: "AI Tasks Completed" },
  { value: "Coming Soon", label: "Automations Executed" },
  { value: "Coming Soon", label: "Hours Saved" },
];

export function TrustSection() {
  return (
    <section className="border-y border-border/70 bg-secondary/10 py-16 sm:py-20">
      <div className="container">
        <Reveal>
          <p className="text-center text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Built for growing businesses
          </p>
        </Reveal>

        <div className="mx-auto mt-10 max-w-3xl">
          <StaggerGroup className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {platformStats.map((stat) => (
              <StaggerItem key={stat.label} className="text-center">
                <p className="gradient-text text-3xl font-semibold tracking-tight sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">{stat.label}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
          <Reveal delay={0.15}>
            <p className="mt-6 text-center text-xs text-muted-foreground/60">
              We&apos;re just getting started &mdash; real usage data will appear here as our
              platform grows.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
