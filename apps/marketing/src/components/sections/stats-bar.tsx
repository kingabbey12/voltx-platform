import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";

const stats = [
  { value: "AI", label: "Agents with governed tool access" },
  { value: "CRM", label: "Connected customer context" },
  { value: "Workflow", label: "Automation with approvals" },
  { value: "Knowledge", label: "Grounded answers from your data" },
];

export function StatsBar() {
  return (
    <section className="border-y border-border/70 bg-secondary/20 py-12 sm:py-16">
      <div className="container">
        <StaggerGroup className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((stat) => (
            <StaggerItem key={stat.label} className="text-center sm:text-left">
              <p className="gradient-text text-3xl font-semibold tracking-tight sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Reveal>
      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
        {children}
      </span>
    </Reveal>
  );
}
