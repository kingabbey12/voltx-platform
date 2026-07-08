"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { LoadingScreen } from "@/components/loading-screen";

/** Guards every route under (app): unauthenticated -> /login; authenticated
 * but onboarding incomplete -> /onboarding (from anywhere except itself);
 * onboarding already complete -> bounced away from /onboarding. Mirrors
 * the mobile app's go_router redirect logic in lib/router/app_router.dart. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (!user) return;

    if (!user.onboardingCompleted && pathname !== "/onboarding") {
      router.replace("/onboarding");
      return;
    }

    if (user.onboardingCompleted && pathname === "/onboarding") {
      router.replace("/dashboard");
    }
  }, [status, user, pathname, router]);

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
    return <LoadingScreen />;
  }

  if (user && !user.onboardingCompleted && pathname !== "/onboarding") {
    return <LoadingScreen />;
  }

  if (user && user.onboardingCompleted && pathname === "/onboarding") {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
