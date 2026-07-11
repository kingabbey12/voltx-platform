"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description="An unexpected error occurred. Try again, or head back to the dashboard."
        action={
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
              Go to dashboard
            </Button>
            <Button onClick={reset}>Try again</Button>
          </div>
        }
      />
    </div>
  );
}
