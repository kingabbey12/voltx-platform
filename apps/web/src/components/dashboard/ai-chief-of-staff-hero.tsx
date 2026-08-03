"use client";

import Link from "next/link";
import { ArrowRight, MessageCircleMore, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDashboardRecommendations } from "@/hooks/use-dashboard";

const prompts = ["What changed today?", "Which deals are at risk?", "What are my top priorities?"];

export function AiChiefOfStaffHero() {
  const { data: recommendations = [] } = useDashboardRecommendations();
  const openCount = recommendations.filter((recommendation) => recommendation.status === "OPEN").length;
  const [timeLabel, setTimeLabel] = useState("Today");

  useEffect(() => {
    const hour = new Date().getHours();
    setTimeLabel(hour < 12 ? "This morning" : hour < 18 ? "This afternoon" : "This evening");
  }, []);

  return (
    <section id="chief-of-staff" className="surface-raised relative min-h-[350px] overflow-hidden rounded-[24px] p-6 sm:p-8 lg:p-9" aria-labelledby="chief-of-staff-title">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,hsl(268_83%_68%/0.32),transparent_65%)] blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-[28%] h-72 w-96 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.20),transparent_68%)] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(hsl(0_0%_100%/0.035)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%/0.035)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(75%_85%_at_70%_20%,black,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">{["12% 26%", "82% 16%", "74% 68%", "38% 78%", "91% 52%"].map((position, index) => <span key={position} className="absolute h-1 w-1 animate-float rounded-full bg-primary/70 shadow-[0_0_14px_hsl(var(--primary)/0.9)]" style={{ left: position.split(" ")[0], top: position.split(" ")[1], animationDelay: `${index * -1.1}s` }} />)}</div>
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(268_83%_68%/0.35)] bg-[hsl(268_83%_68%/0.13)] px-3 py-1 text-xs font-semibold text-[hsl(268_83%_76%)]"><Sparkles className="h-3.5 w-3.5" />AI Chief of Staff <span className="h-1 w-1 rounded-full bg-success shadow-[0_0_8px_hsl(var(--success)/0.9)]" />Live</span>
          <h2 id="chief-of-staff-title" className="mt-5 text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl">Your AI Chief of Staff</h2>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-primary">{timeLabel}, verified executive signals are ready.</p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">Your Chief of Staff organizes the dashboard signals and persisted recommendations Voltx can explain, then presents only the actions that are available for your approval.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {prompts.map((prompt) => <Link key={prompt} href="/ai" className="rounded-full border border-white/[0.10] bg-black/20 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-[hsl(268_83%_68%/0.45)] hover:text-foreground">{prompt}</Link>)}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/ai"><MessageCircleMore className="h-4 w-4" />Chat with AI</Link></Button>
            <Button asChild size="lg" variant="ghost"><Link href="#priorities">View recommendations<ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>
        <div className="relative mx-auto grid h-56 w-56 place-items-center" aria-hidden>
          <div className="absolute inset-0 animate-[spin_18s_linear_infinite] rounded-full border border-[hsl(268_83%_68%/0.28)]" />
          <div className="absolute inset-5 animate-[spin_14s_linear_infinite_reverse] rounded-full border border-primary/25" />
          <div className="absolute inset-10 animate-float rounded-full border border-white/10 bg-[radial-gradient(circle_at_35%_30%,hsl(268_83%_76%/0.75),hsl(268_83%_38%/0.18)_45%,transparent_70%)] shadow-[0_0_100px_hsl(268_83%_68%/0.45)]" />
          <div className="relative grid h-20 w-20 place-items-center rounded-[28px] border border-primary/30 bg-black/45 shadow-[0_0_36px_hsl(var(--primary)/0.38)] backdrop-blur"><Sparkles className="h-8 w-8 text-primary" /></div>
          <span className="absolute -bottom-2 rounded-full border border-white/[0.10] bg-black/45 px-3 py-1 text-[11px] font-medium text-foreground/80 backdrop-blur">{openCount ? `${openCount} decisions ready` : "Monitoring live signals"}</span>
        </div>
      </div>
    </section>
  );
}