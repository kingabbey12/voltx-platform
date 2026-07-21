"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { useAsk } from "@/hooks/use-ask";
import { askApi, type AskDoor, type ResolvedRecord } from "@/lib/ai/ask-client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Search over the Company (docs/design/COMPANY.md §7, requirement: reuse
 * the Ask grounding pipeline, no duplicate search implementation). A
 * submitted query runs one real Ask turn; every door Ask grounded in its
 * answer — record ids it actually read via tool calls this turn — is
 * resolved to a canonical label + route through the same endpoint the
 * record resolver already exposes, then bucketed for display. No new
 * index, no parallel query engine.
 */

type Bucket = "parties" | "documents" | "conversations" | "records";

const PARTY_TYPES = new Set(["sales.company", "sales.contact", "organization"]);
const DOCUMENT_TYPES = new Set(["document", "knowledge.document"]);
const CONVERSATION_TYPES = new Set(["conversation"]);

function bucketFor(recordType: string): Bucket {
  if (PARTY_TYPES.has(recordType)) return "parties";
  if (DOCUMENT_TYPES.has(recordType)) return "documents";
  if (CONVERSATION_TYPES.has(recordType)) return "conversations";
  return "records";
}

const BUCKET_LABELS: Record<Bucket, string> = {
  parties: "Parties",
  documents: "Documents",
  conversations: "Conversations",
  records: "Records",
};

interface ResolvedDoor extends ResolvedRecord {
  bucket: Bucket;
}

export function CompanySearch() {
  const { exchange, ask } = useAsk();
  const [query, setQuery] = useState("");
  const [resolved, setResolved] = useState<ResolvedDoor[] | null>(null);
  const [resolving, setResolving] = useState(false);

  const resolveDoors = useCallback(async (doors: AskDoor[]) => {
    const uniqueById = new Map(doors.map((door) => [`${door.recordType}:${door.recordId}`, door]));
    setResolving(true);
    try {
      const results = await Promise.all(
        Array.from(uniqueById.values()).map(async (door) => {
          try {
            const record = await askApi.resolveRecord(door.recordType, door.recordId);
            return { ...record, bucket: bucketFor(record.type) };
          } catch {
            return null;
          }
        }),
      );
      setResolved(results.filter((r): r is ResolvedDoor => r !== null));
    } finally {
      setResolving(false);
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      setResolved(null);
      await ask(`Find every record matching: ${trimmed}`);
    },
    [query, ask],
  );

  // Once Ask's structured response lands, ground its doors into canonical
  // records — this is the one place the response is consumed for search.
  const doors = exchange.response?.segments.flatMap((segment) => segment.doors) ?? [];
  const doorsKey = doors.map((d) => `${d.recordType}:${d.recordId}`).join(",");

  useEffect(() => {
    if (exchange.status !== "done") return;
    if (doors.length > 0) {
      void resolveDoors(doors);
    } else {
      setResolved([]);
    }
    // doorsKey is the stable dependency; doors/resolveDoors are derived each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchange.status, doorsKey]);

  const grouped = useMemo(() => {
    const buckets: Record<Bucket, ResolvedDoor[]> = {
      parties: [],
      documents: [],
      conversations: [],
      records: [],
    };
    for (const record of resolved ?? []) {
      buckets[record.bucket].push(record);
    }
    return buckets;
  }, [resolved]);

  const isSearching = exchange.status === "asking" || resolving;

  return (
    <div>
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the company — records, documents, conversations, people"
          className="pl-9"
          aria-label="Search the company"
        />
      </form>

      {isSearching && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {exchange.doing ?? "Searching…"}
        </p>
      )}

      {exchange.status === "error" && (
        <p className="mt-3 text-sm text-destructive" role="status">
          {exchange.error}
        </p>
      )}

      {resolved && resolved.length === 0 && exchange.status === "done" && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          Nothing grounded for &ldquo;{query}&rdquo;.
        </p>
      )}

      {resolved && resolved.length > 0 && (
        <Card className="mt-3">
          <CardContent className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2" role="list" aria-label="Search results">
            {(Object.keys(BUCKET_LABELS) as Bucket[])
              .filter((bucket) => grouped[bucket].length > 0)
              .map((bucket) => (
                <div key={bucket} role="listitem">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {BUCKET_LABELS[bucket]}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {grouped[bucket].map((record) => (
                      <li key={`${record.type}:${record.id}`} className="text-sm">
                        {record.route ? (
                          <Link href={record.route} className="text-primary hover:underline">
                            {record.label}
                          </Link>
                        ) : (
                          <span>{record.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
