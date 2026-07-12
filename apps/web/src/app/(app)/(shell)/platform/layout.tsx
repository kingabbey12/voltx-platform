"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { LoadingScreen } from "@/components/loading-screen";

/** Client-gated on isPlatformAdmin (v2.2 Platform Console) — every real
 * enforcement already happens server-side via PLATFORM_ADMIN_GUARDS on
 * every backend endpoint this section calls; this redirect only avoids
 * flashing platform-admin UI at a normal user before their first request
 * 403s. */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (user && !user.isPlatformAdmin) {
      router.replace("/dashboard");
    }
  }, [status, user, router]);

  if (status !== "authenticated" || !user) {
    return <LoadingScreen />;
  }

  if (!user.isPlatformAdmin) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
