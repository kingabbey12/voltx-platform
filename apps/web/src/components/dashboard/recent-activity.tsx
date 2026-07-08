"use client";

import { Calendar, CheckSquare, Mail, MessageCircle, Phone, StickyNote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActivities } from "@/hooks/use-sales";
import { formatRelativeTime } from "@/lib/format";
import type { ActivityType } from "@/lib/api/sales";

const TYPE_ICON: Record<ActivityType, LucideIcon> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Calendar,
  TASK: CheckSquare,
  NOTE: StickyNote,
};

export function RecentActivity() {
  const { data, isLoading } = useActivities({ limit: 6 });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <MessageCircle className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs text-muted-foreground">
              Calls, emails, meetings, and notes will show up here.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {data?.items.map((activity) => {
            const Icon = TYPE_ICON[activity.type];
            return (
              <div key={activity.id} className="flex items-start gap-3 rounded-lg px-2 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{activity.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(activity.occurredAt ?? activity.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
