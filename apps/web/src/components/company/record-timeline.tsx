"use client";

import { Activity, CheckCircle2, FileText, Handshake, Loader2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useCompanyTimeline } from "@/hooks/use-company";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { friendlyErrorMessage } from "@/lib/api/api-error";

/**
 * Every canonical record's timeline (docs/design/COMPANY.md §3/§4):
 * created, updated, and related events/conversations/documents/promises,
 * read from GET /company/timeline/:recordType/:recordId — the same
 * aggregation the Company home uses, not a page-local re-implementation.
 */
export function RecordTimeline({ recordType, recordId }: { recordType: string; recordId: string }) {
  const { data, isLoading, isError, error } = useCompanyTimeline(recordType, recordId);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading timeline…
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive" role="status">
        {friendlyErrorMessage(error)}
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground">
        Created {formatDate(data.createdAt)} · Updated {formatRelativeTime(data.updatedAt)}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" role="list" aria-label="Timeline">
        <TimelineSection
          title="Events"
          icon={Activity}
          section={data.events}
          renderItem={(event) => (
            <>
              <p className="font-medium">{event.subject}</p>
              <p className="text-xs text-muted-foreground">
                {event.type} · {formatRelativeTime(event.occurredAt)}
              </p>
            </>
          )}
        />
        <TimelineSection
          title="Conversations"
          icon={MessageSquare}
          section={data.conversations}
          renderItem={(conversation) => (
            <>
              <p className="font-medium">{conversation.subject ?? "Untitled conversation"}</p>
              <p className="text-xs text-muted-foreground">
                {conversation.channel}
                {conversation.lastMessageAt ? ` · ${formatRelativeTime(conversation.lastMessageAt)}` : ""}
              </p>
            </>
          )}
        />
        <TimelineSection
          title="Documents"
          icon={FileText}
          section={data.documents}
          renderItem={(document) => <p className="font-medium">{document.fileName}</p>}
        />
        <TimelineSection
          title="Promises"
          icon={Handshake}
          section={data.promises}
          renderItem={(promise) => (
            <div className="flex items-center justify-between">
              <Link href={`/promises/${promise.id}`} className="font-medium text-primary hover:underline">
                {promise.title}
              </Link>
              <Badge variant="outline">{promise.status}</Badge>
            </div>
          )}
        />
        <TimelineSection
          title="Approvals"
          icon={CheckCircle2}
          section={data.approvals}
          renderItem={(approval) => (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium">{approval.summary ?? approval.toolName}</span>
                <Badge variant={approval.status === "APPROVED" ? "success" : approval.status === "REJECTED" ? "destructive" : "secondary"}>
                  {approval.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {approval.decidedAt
                  ? `Decided ${formatRelativeTime(approval.decidedAt)}`
                  : `Requested ${formatRelativeTime(approval.createdAt)}`}
              </p>
            </>
          )}
        />
      </div>
    </div>
  );
}

interface Section<T> {
  available: boolean;
  reason?: string;
  total: number;
  items: T[];
}

function TimelineSection<T extends { id: string }>({
  title,
  icon: Icon,
  section,
  renderItem,
}: {
  title: string;
  icon: React.ElementType;
  section: Section<T>;
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <div role="listitem">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      {!section.available ? (
        <p className="text-sm text-muted-foreground">{section.reason ?? "Not available."}</p>
      ) : section.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {section.items.map((item) => (
            <li key={item.id} className="text-sm">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
