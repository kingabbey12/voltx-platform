"use client";

import { motion } from "framer-motion";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { MOTION, riseIn, transition } from "@/lib/design-language";
import { useAuthStore } from "@/lib/stores/auth-store";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { AiCopilotHero } from "@/components/dashboard/ai-copilot-hero";
import {
  BusinessHealth,
  Priorities,
  TodaysBrief,
} from "@/components/dashboard/executive-intelligence";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { QuickActions } from "@/components/dashboard/quick-actions";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Ordered by the question each section answers, not by which feature module it
 * belongs to:
 *
 *   greeting          who and when
 *   KPI row           what are the numbers
 *   AI Copilot        what is this product for
 *   Quick actions     what can I start right now
 *   Brief / Health /
 *   Priorities        what should I know, and what should I do
 *   Recent activity   what happened
 *
 * Recent activity moves last deliberately. It previously shared the widest row
 * on the page with quick actions, which put operational history on equal
 * footing with everything strategic above it.
 *
 * The whole page is fed by one query (useDashboardMetrics), so every section
 * shares a loading state instead of resolving at six different moments.
 */

/** Stagger step. Small enough that the page reads as one movement rather than
 *  a sequence of independent arrivals. */
const STEP = 0.05;

function Section({ index, children }: { index: number; children: React.ReactNode }) {
  // Curve and duration come from the shared motion vocabulary, so a section
  // entering decelerates identically to a card lifting or a dialog opening.
  return (
    <motion.div {...riseIn} transition={transition(MOTION.slow, index * STEP)}>
      {children}
    </motion.div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <PageContainer size="default">
      <Section index={0}>
        <PageHeader
          title={`${greeting()}${user ? `, ${user.firstName}` : ""}`}
          description="Here's what's happening across your business today."
        />
      </Section>

      <Section index={1}>
        <KpiCards />
      </Section>

      <Section index={2}>
        <AiCopilotHero />
      </Section>

      <Section index={3}>
        <QuickActions />
      </Section>

      {/* The intelligence row. Three sections that each answer a different
          executive question, side by side so none of them dominates. */}
      <Section index={4}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TodaysBrief />
          </div>
          <BusinessHealth />
        </div>
      </Section>

      <Section index={5}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Priorities />
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>
        </div>
      </Section>
    </PageContainer>
  );
}
