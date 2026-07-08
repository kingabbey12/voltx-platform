"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/lib/stores/auth-store";
import { BrandMark } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    router.replace(user.onboardingCompleted ? "/dashboard" : "/onboarding");
  }, [status, user, router]);

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
      >
        <div className="absolute left-1/2 top-[-10%] h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px] dark:bg-primary/20" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 flex items-center gap-2.5"
      >
        <BrandMark />
        <span className="text-lg font-semibold tracking-tight">Voltx</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[400px]"
      >
        {children}
      </motion.div>
    </div>
  );
}
