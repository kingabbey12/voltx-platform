import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  title: string;
  description?: string;
  onRetry: () => void;
}

export function QueryErrorState({
  title,
  description = "Your existing records are unchanged. Check your connection and try again.",
  onRetry,
}: QueryErrorStateProps) {
  return (
    <div role="alert" className="px-5 py-14 text-center sm:px-6">
      <AlertTriangle className="mx-auto h-6 w-6 text-warning" aria-hidden />
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Button size="sm" className="mt-5" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        Try again
      </Button>
    </div>
  );
}