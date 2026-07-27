"use client";

import { Bell, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAiSuggestions, useDismissSuggestion } from "@/hooks/use-ai-dashboard";
import { friendlyErrorMessage } from "@/lib/api/api-error";

export function NotificationsWidget() {
  const { data, isLoading } = useAiSuggestions();
  const dismiss = useDismissSuggestion();

  const suggestions = data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Bell className="h-4 w-4" />
          Notifications
        </CardTitle>
        {!isLoading && suggestions.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {suggestions.length}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && suggestions.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <Bell className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No notifications</p>
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            {suggestions.slice(0, 5).map((s) => (
              <div key={s.id} className="group relative rounded-lg border border-border p-2.5 pr-8 text-xs">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{s.title}</span>
                </div>
                <p className="mt-0.5 text-muted-foreground">{s.description}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() =>
                    dismiss.mutate(s.id, {
                      onSuccess: () => toast.success("Dismissed"),
                      onError: (e) => toast.error(friendlyErrorMessage(e)),
                    })
                  }
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
