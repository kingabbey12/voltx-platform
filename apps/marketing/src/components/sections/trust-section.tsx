import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";

const platformPrinciples = [
  { title: "One source of truth", description: "Customer context, operational data, and decisions stay connected." },
  { title: "AI with accountability", description: "Every recommendation, action, and approval is visible to your team." },
  { title: "Built to scale with you", description: "Start with a focused workflow and extend across the business." },
];

export function TrustSection() {
  return (
    <section className="border-y border-border/70 bg-secondary/10 py-16 sm:py-20">
      <div className="container">
        <Reveal>
          <p className="text-center text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Trusted by ambitious businesses building with AI
          </p>
        </Reveal>

        <div className="mx-auto mt-10 max-w-4xl">
          <StaggerGroup className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {platformPrinciples.map((principle) => (
              <StaggerItem key={principle.title} className="text-center">
                <p className="text-base font-medium text-foreground">{principle.title}</p>
                <p className="mx-auto mt-2 max-w-[15rem] text-sm leading-relaxed text-muted-foreground">{principle.description}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
