import { ArrowRight, FileCheck2, Fingerprint, Landmark, Lock, ScrollText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";

const pillars = [
  {
    icon: Lock,
    title: "Tenant isolation, enforced in the ORM",
    description:
      "Row-level isolation is baked into the data layer itself — every query is scoped to your organization before it ever reaches the database.",
  },
  {
    icon: Fingerprint,
    title: "SSO & SCIM",
    description:
      "SAML/OIDC single sign-on with just-in-time provisioning, and SCIM sync to keep seats matched to your directory automatically.",
  },
  {
    icon: ShieldCheck,
    title: "Granular RBAC",
    description:
      "Per-organization roles with resource-level permissions — including custom roles — govern every action agents and people take.",
  },
  {
    icon: ScrollText,
    title: "Tamper-evident audit",
    description:
      "Every core action lands in a hash-chained audit log; exports verify the chain so gaps and edits are mathematically detectable.",
  },
  {
    icon: FileCheck2,
    title: "Compliance Center",
    description:
      "GDPR export and erasure, legal holds, and consent history — operable from the product, not a support ticket.",
  },
  {
    icon: Landmark,
    title: "Governed AI autonomy",
    description:
      "Agent tool access is allow-listed per agent, and sensitive operations route through human approval steps in workflows.",
  },
];

export function EnterpriseSection() {
  return (
    <section id="enterprise" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[10%] top-[20%] h-[26rem] w-[40rem] rounded-full bg-primary/10 blur-[150px]" />
      </div>

      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <SectionEyebrow>Enterprise</SectionEyebrow>
          <Reveal delay={0.05}>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
              Autonomy your security team can sign off on
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mt-5 text-lg leading-relaxed text-muted-foreground">
              Voltx was built multi-tenant and auditable from the first commit — not
              retrofitted for the enterprise checklist later.
            </p>
          </Reveal>
        </div>

        <StaggerGroup className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <StaggerItem key={pillar.title}>
              <div className="group h-full rounded-2xl border border-white/10 bg-card/50 p-6 backdrop-blur-sm transition-colors duration-300 hover:border-primary/30">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                  <pillar.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pillar.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <Reveal delay={0.1} className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <a href="/enterprise">
              Explore enterprise
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Button>
          <Button variant="secondary" asChild>
            <a href="/contact">Talk to our team</a>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
