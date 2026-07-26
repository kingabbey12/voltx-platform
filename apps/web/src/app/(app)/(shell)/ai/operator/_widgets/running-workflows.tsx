"use client";

import { Loader2, GitBranch, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAiTasks } from "@/hooks/use-ai-dashboard";

export function RunningWorkflowsWidget() {
  const { data, isLoading } = useAiTasks();

  const inProgress = data?.inProgressRuns ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <GitBranch className="h-4 w-4" />
          Running Workflows
        </CardTitle>
        {!isLoading && inProgress.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
            {inProgress.length}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && inProgress.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <Play className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No workflows running</p>
          </div>
        )}
        {inProgress.length > 0 && (
          <div className="space-y-1.5">
            {inProgress.slice(0, 5).map((run) => (
              <div key={run.id} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{run.id.slice(0, 8)}...</p>
                  <p className="text-[11px] text-muted-foreground">{run.toolCallCount} tool calls</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
