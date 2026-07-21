"use client";

import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  Building2,
  FileText,
  Handshake,
  MessageSquare,
  Package,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingScreen } from "@/components/loading-screen";
import { CompanySearch } from "@/components/company/company-search";
import { useCompanyHome } from "@/hooks/use-company";
import { formatBytes, formatDate, formatRelativeTime } from "@/lib/format";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type {
  CompanyHomeSection,
  ConversationSummary,
  DocumentSummary,
  EventSummary,
  PersonSummary,
  PromiseSummary,
} from "@/lib/api/company";

/**
 * The Company home (docs/design/COMPANY.md): the canonical place a
 * business understands itself. Every section below is a thin read over
 * GET /company/home — no local aggregation, no mock data. Sections a
 * caller's role can't see report why instead of being silently hidden.
 */
export default function CompanyHomePage() {
  const { data, isLoading, isError, error } = useCompanyHome();

  if (isLoading) return <LoadingScreen />;

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-sm text-destructive" role="status">
          {friendlyErrorMessage(error)}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{data.organization.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">{data.organization.status}</Badge>
            {data.organization.industry && (
              <span className="text-sm text-muted-foreground">{data.organization.industry}</span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Added {formatDate(data.organization.createdAt)} · Updated{" "}
        {formatRelativeTime(data.organization.updatedAt)}
      </p>

      <div className="mt-6">
        <CompanySearch />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2" role="list" aria-label="Company sections">
        <div role="listitem">
          <SectionCard title="People" icon={Users} count={data.people.available ? data.people.total : undefined}>
            <SectionBody
              section={data.people}
              emptyIcon={Users}
              emptyTitle="No people yet"
              renderItem={(person: PersonSummary) => (
                <div className="flex items-center justify-between">
                  <span className="font-medium">{person.name || person.email || "Unnamed"}</span>
                  <Badge variant="outline">{person.kind}</Badge>
                </div>
              )}
              keyOf={(person: PersonSummary) => `${person.kind}-${person.id}`}
            />
          </SectionCard>
        </div>

        <div role="listitem">
          <SectionCard
            title="Documents"
            icon={FileText}
            count={data.documents.available ? data.documents.total : undefined}
          >
            <SectionBody
              section={data.documents}
              emptyIcon={FileText}
              emptyTitle="No documents yet"
              renderItem={(document: DocumentSummary) => (
                <>
                  <p className="font-medium">{document.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(document.sizeBytes)} · {formatRelativeTime(document.createdAt)}
                  </p>
                </>
              )}
              keyOf={(document: DocumentSummary) => document.id}
            />
          </SectionCard>
        </div>

        <div role="listitem">
          <SectionCard
            title="Conversations"
            icon={MessageSquare}
            count={data.conversations.available ? data.conversations.total : undefined}
          >
            <SectionBody
              section={data.conversations}
              emptyIcon={MessageSquare}
              emptyTitle="No conversations yet"
              renderItem={(conversation: ConversationSummary) => (
                <>
                  <p className="font-medium">{conversation.subject ?? "Untitled conversation"}</p>
                  <p className="text-xs text-muted-foreground">
                    {conversation.channel}
                    {conversation.lastMessageAt
                      ? ` · ${formatRelativeTime(conversation.lastMessageAt)}`
                      : ""}
                  </p>
                </>
              )}
              keyOf={(conversation: ConversationSummary) => conversation.id}
            />
          </SectionCard>
        </div>

        <div role="listitem">
          <SectionCard
            title="Events"
            icon={ActivityIcon}
            count={data.events.available ? data.events.total : undefined}
          >
            <SectionBody
              section={data.events}
              emptyIcon={ActivityIcon}
              emptyTitle="Nothing happened yet"
              renderItem={(event: EventSummary) => (
                <>
                  <p className="font-medium">{event.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.type} · {formatRelativeTime(event.occurredAt)}
                  </p>
                </>
              )}
              keyOf={(event: EventSummary) => event.id}
            />
          </SectionCard>
        </div>

        <div role="listitem">
          <SectionCard
            title="Promises"
            icon={Handshake}
            count={data.promises.available ? data.promises.total : undefined}
          >
            <SectionBody
              section={data.promises}
              emptyIcon={Handshake}
              emptyTitle="No promises in formation"
              renderItem={(promise: PromiseSummary) => (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Link href={`/promises/${promise.id}`} className="font-medium text-primary hover:underline">
                      {promise.title}
                    </Link>
                    {promise.dueAt && (
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(promise.dueAt)}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">{promise.status}</Badge>
                </div>
              )}
              keyOf={(promise: PromiseSummary) => promise.id}
            />
          </SectionCard>
        </div>

        <div role="listitem">
          <SectionCard title="Assets" icon={Package}>
            <EmptyState icon={Package} title="Assets aren't modeled yet" description={data.assets.reason} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: ElementType;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {count !== undefined && <Badge variant="secondary">{count}</Badge>}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function SectionBody<T>({
  section,
  emptyIcon,
  emptyTitle,
  renderItem,
  keyOf,
}: {
  section: CompanyHomeSection<T>;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  renderItem: (item: T) => ReactNode;
  keyOf: (item: T) => string;
}) {
  if (!section.available) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {section.reason ?? "Not available."}
      </p>
    );
  }
  if (section.items.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {section.items.map((item) => (
        <li key={keyOf(item)} className="text-sm">
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
