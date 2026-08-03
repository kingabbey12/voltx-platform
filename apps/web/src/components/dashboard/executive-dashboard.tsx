"use client";

import { motion } from "framer-motion";
import { AiChiefOfStaffHero } from "@/components/dashboard/ai-chief-of-staff-hero";
import { BusinessHealthCard } from "@/components/dashboard/business-health-card";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ExecutiveKpiGrid } from "@/components/dashboard/executive-kpi-grid";
import { ExecutiveAnalyticsCenter } from "@/components/dashboard/executive-analytics-center";
import { ExecutiveDecisionCenter } from "@/components/dashboard/executive-decision-center";
import { PrioritiesCard } from "@/components/dashboard/priorities-card";
import { QuickActionsPanel } from "@/components/dashboard/quick-actions-panel";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { TodaysBriefCard } from "@/components/dashboard/todays-brief-card";
import { PageContainer } from "@/components/layout/page-container";
import { MOTION, riseIn, transition } from "@/lib/design-language";

function DashboardSection({ index, children }: { index: number; children: React.ReactNode }) {
  return <motion.div {...riseIn} transition={transition(MOTION.base, index * 0.045)}>{children}</motion.div>;
}

export function ExecutiveDashboard() {
  return (
    <PageContainer size="wide" className="relative pb-28 pt-7 sm:pt-9">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_top,hsl(268_83%_68%/0.075),transparent_56%),radial-gradient(circle_at_82%_12%,hsl(var(--primary)/0.07),transparent_28%)]" />
      <div className="space-y-5 sm:space-y-6">
        <DashboardSection index={0}><DashboardHeader /></DashboardSection>
        <DashboardSection index={1}><ExecutiveKpiGrid /></DashboardSection>
        <DashboardSection index={2}><div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(390px,0.9fr)]"><AiChiefOfStaffHero /><QuickActionsPanel /></div></DashboardSection>
        <DashboardSection index={3}><div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4"><TodaysBriefCard /><BusinessHealthCard /><PrioritiesCard /><RecentActivityCard /></div></DashboardSection>
        <DashboardSection index={4}><ExecutiveAnalyticsCenter /></DashboardSection>
        <DashboardSection index={5}><ExecutiveDecisionCenter /></DashboardSection>
      </div>
    </PageContainer>
  );
}
