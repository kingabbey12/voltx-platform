"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { authApi } from "@/lib/api/auth";
import { tokenStorage } from "@/lib/api/token-storage";
import { registerSessionExpiredHandler } from "@/lib/api/client";

/** Bootstraps the session once on app load and wires the API client's
 * session-expired callback to clear state and bounce to /login — mirrors
 * the mobile app's AuthSplashScreen + restoreSession() bootstrap. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);
  const router = useRouter();
  const hasBootstrapped = useRef(false);

  useEffect(() => {
    registerSessionExpiredHandler(() => {
      setUnauthenticated();
      router.replace("/login");
    });
  }, [router, setUnauthenticated]);

  useEffect(() => {
    if (hasBootstrapped.current) return;
    hasBootstrapped.current = true;

    async function restoreSession() {
      const tokens = tokenStorage.read();
      if (!tokens) {
        setUnauthenticated();
        return;
      }
      try {
        const user = await authApi.me();
        setUser(user);
      } catch {
        tokenStorage.clear();
        setUnauthenticated();
      }
    }

    void restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
