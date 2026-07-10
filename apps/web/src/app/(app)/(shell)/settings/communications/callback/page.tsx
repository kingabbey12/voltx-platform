"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useCompleteCommsOAuth } from "@/hooks/use-communications";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { commsOAuthRedirectUri } from "@/lib/comms-oauth";

function OAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const completeOAuth = useCompleteCommsOAuth();
  const [status, setStatus] = useState<"working" | "success" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const providerError = searchParams.get("error");

    if (providerError) {
      setStatus("error");
      setError(providerError === "access_denied" ? "You declined the authorization request." : providerError);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setError("This authorization link is missing its code or state parameter.");
      return;
    }

    completeOAuth.mutate(
      { connectionId: state, code, redirectUri: commsOAuthRedirectUri() },
      {
        onSuccess: () => {
          setStatus("success");
          setTimeout(() => router.replace("/settings/communications"), 1200);
        },
        onError: (err) => {
          setStatus("error");
          setError(friendlyErrorMessage(err));
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      {status === "working" && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Finishing connection...</p>
        </>
      )}
      {status === "success" && (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">Connected</p>
        </>
      )}
      {status === "error" && (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <XCircle className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">Couldn&apos;t connect</p>
          <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
          <button
            onClick={() => router.replace("/settings/communications")}
            className="text-xs font-medium text-primary hover:underline"
          >
            Back to Communications
          </button>
        </>
      )}
    </div>
  );
}

export default function CommsOAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallback />
    </Suspense>
  );
}
