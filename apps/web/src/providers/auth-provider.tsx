"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useImpersonationStore } from "@/lib/stores/impersonation-store";
import { authApi } from "@/lib/api/auth";
import { tokenStorage } from "@/lib/api/token-storage";
import { registerImpersonationEndedHandler, registerSessionExpiredHandler } from "@/lib/api/client";

/** Bootstraps the session once on app load and wires the API client's
 * session-expired callback to clear state and bounce to /login — mirrors
 * the mobile app's AuthSplashScreen + restoreSession() bootstrap. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);
  const setImpersonationInfo = useImpersonationStore((state) => state.setInfo);
  const router = useRouter();
  const hasBootstrapped = useRef(false);

  useEffect(() => {
    registerSessionExpiredHandler(() => {
      setUnauthenticated();
      setImpersonationInfo(null);
      router.replace("/login");
    });

    registerImpersonationEndedHandler(() => {
      setImpersonationInfo(null);
      toast.error("Support session has ended — returned to your own session.");
      authApi
        .me()
        .then(setUser)
        .catch(() => undefined);
      router.replace("/platform/organizations");
    });
  }, [router, setUnauthenticated, setUser, setImpersonationInfo]);

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

        const impersonationStash = tokenStorage.getImpersonationStash();
        if (impersonationStash) {
          setImpersonationInfo({
            sessionId: impersonationStash.sessionId,
            organizationId: impersonationStash.organizationId,
            organizationName: impersonationStash.organizationName,
          });
        }
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
