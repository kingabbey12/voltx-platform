import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

export interface FeatureDetail {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
}

export function FeatureDetailBlock({
  feature,
  reverse = false,
}: {
  feature: FeatureDetail;
  reverse?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-20",
      )}
    >
      <Reveal className={cn(reverse && "lg:order-2")}>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
          {feature.eyebrow}
        </span>
        <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          {feature.title}
        </h2>
        <p className="text-pretty mt-4 text-lg leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
        <ul className="mt-7 flex flex-col gap-3">
          {feature.points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm text-foreground/90">
              <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" />
              {point}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.1} className={cn(reverse && "lg:order-1")}>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl">
          <div
            aria-hidden
            className="absolute -inset-8 -z-10 rounded-full bg-primary/20 blur-3xl"
          />
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
              <feature.icon className="h-8 w-8" />
            </div>
            <p className="text-sm text-muted-foreground">{feature.title}</p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
