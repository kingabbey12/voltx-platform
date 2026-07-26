"use client";

import { BookOpen, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDailyBrief } from "@/hooks/use-daily-brief";
import { useAuthStore } from "@/lib/stores/auth-store";

export function DailyBriefWidget() {
  const organizationId = useAuthStore((state) => state.user?.organizationId);
  const { text, loading, error, regenerate } = useDailyBrief(organizationId);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4" />
          Daily Brief
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={regenerate} isLoading={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading && !text && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating your daily brief...
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Could not generate brief</p>
              <p className="mt-0.5 text-xs">{error}</p>
            </div>
          </div>
        )}
        {text && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
            {text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
