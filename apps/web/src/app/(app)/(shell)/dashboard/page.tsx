"use client";

import { motion } from "framer-motion";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthStore } from "@/lib/stores/auth-store";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DailyBrief } from "@/components/dashboard/daily-brief";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    // `default` (max-w-6xl), not `wide`. Reviewed at 1440px: `wide`
    // (max-w-[1400px]) stretched the content to the viewport edges and pulled
    // each KPI card out to ~270px holding a single number, which read as empty
    // rather than spacious. A bounded column keeps the KPI row dense and the
    // eye travelling down the page instead of across it.
    <PageContainer size="default">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <PageHeader
          title={`${greeting()}${user ? `, ${user.firstName}` : ""}`}
          description="Here's what's happening across your workspace."
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
      >
        <KpiCards />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <DailyBrief />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      >
        <div className="lg:col-span-2">
          <QuickActions />
        </div>
        <RecentActivity />
      </motion.div>
    </PageContainer>
  );
}
