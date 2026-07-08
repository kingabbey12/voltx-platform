"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { LoadingScreen } from "@/components/loading-screen";

export default function RootPage() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !user) {
      router.replace("/login");
      return;
    }
    router.replace(user.onboardingCompleted ? "/dashboard" : "/onboarding");
  }, [status, user, router]);

  return <LoadingScreen />;
}
