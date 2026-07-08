"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useDailyBrief } from "@/hooks/use-daily-brief";

export function DailyBrief() {
  const organizationId = useAuthStore((state) => state.user?.organizationId);
  const { text, loading, error, regenerate } = useDailyBrief(organizationId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Today&apos;s brief
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => void regenerate()}
          disabled={loading}
          aria-label="Regenerate today's brief"
        >
          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && !text && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading your pipeline, tasks, and workflows...
          </div>
        )}

        {error && !text && (
          <p className="py-4 text-sm text-muted-foreground">
            Couldn&apos;t generate a brief right now. {error}
          </p>
        )}

        {text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>}
      </CardContent>
    </Card>
  );
}
