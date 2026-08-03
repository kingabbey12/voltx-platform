import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiError } from "@/lib/api/api-error";

interface DetailLoadStateProps {
  entityName: string;
  backHref: string;
  backLabel: string;
  error?: unknown;
  onRetry: () => void;
}

export function DetailLoadState({
  entityName,
  backHref,
  backLabel,
  error,
  onRetry,
}: DetailLoadStateProps) {
  const isNotFound = error instanceof ApiError && error.isNotFound;

  return (
    <section
      className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8"
      role="alert"
      aria-labelledby="detail-load-title"
    >
      <h1 id="detail-load-title" className="sr-only">
        {isNotFound ? `${entityName} not found` : `Unable to load ${entityName.toLowerCase()}`}
      </h1>
      <div className="surface-raised rounded-[24px] px-6 py-3">
        <EmptyState
          icon={AlertTriangle}
          title={isNotFound ? `${entityName} not found` : `Unable to load ${entityName.toLowerCase()}`}
          description={
            isNotFound
              ? `This ${entityName.toLowerCase()} may have been deleted or you may no longer have access.`
              : "Your existing data is unchanged. Check your connection and try again."
          }
          action={
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              {!isNotFound && (
                <Button size="sm" onClick={onRetry}>
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Try again
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <Link href={backHref}>
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  {backLabel}
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    </section>
  );
}