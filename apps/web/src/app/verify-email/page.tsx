"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandMark } from "@/components/brand-mark";
import { useVerifyEmail } from "@/hooks/use-auth";
import { friendlyErrorMessage } from "@/lib/api/api-error";

/**
 * Deliberately its own top-level route rather than under (auth)/ — that
 * group's layout redirects away whenever the user is already
 * authenticated (see (auth)/layout.tsx), which would fire here for the
 * common case of a just-registered user (already logged in) opening the
 * verification link in a new tab, before the token could ever be
 * consumed.
 */
function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const verifyEmail = useVerifyEmail();
  const hasAttempted = useRef(false);
  const [state, setState] = useState<"pending" | "success" | "error">("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token || hasAttempted.current) return;
    hasAttempted.current = true;

    verifyEmail.mutate(token, {
      onSuccess: () => setState("success"),
      onError: (error) => {
        setErrorMessage(friendlyErrorMessage(error));
        setState("error");
      },
    });
  }, [token, verifyEmail]);

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
      >
        <div className="absolute left-1/2 top-[-10%] h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
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
        <Card className="border-border/70 shadow-lg">
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            {!token ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
                  <XCircle className="h-7 w-7 text-destructive" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Invalid verification link</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    This link is missing its token. Sign in and request a new verification email
                    from your account settings.
                  </p>
                </div>
                <Button asChild className="mt-2 w-full">
                  <Link href="/login">Back to sign in</Link>
                </Button>
              </>
            ) : state === "pending" ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Verifying your email…</h2>
                </div>
              </>
            ) : state === "success" ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Email verified</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Your email address has been confirmed.
                  </p>
                </div>
                <Button asChild className="mt-2 w-full">
                  <Link href="/dashboard">Continue to Voltx</Link>
                </Button>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
                  <XCircle className="h-7 w-7 text-destructive" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Verification failed</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {errorMessage ?? "This link is invalid or has expired."}
                  </p>
                </div>
                <Button asChild className="mt-2 w-full">
                  <Link href="/login">Back to sign in</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
