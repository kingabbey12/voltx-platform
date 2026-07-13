"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useOpenApiDocument } from "@/hooks/use-developer-portal";
import { flattenOperations, type OpenApiOperation } from "@/lib/api/developer-portal";
import { cn } from "@/lib/utils";

const METHOD_VARIANT: Record<string, string> = {
  GET: "bg-blue-500/15 text-blue-400",
  POST: "bg-emerald-500/15 text-emerald-400",
  PATCH: "bg-amber-500/15 text-amber-400",
  PUT: "bg-amber-500/15 text-amber-400",
  DELETE: "bg-red-500/15 text-red-400",
};

function OperationRow({ operation }: { operation: OpenApiOperation }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <span
          className={cn(
            "w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-semibold",
            METHOD_VARIANT[operation.method] ?? "bg-secondary text-secondary-foreground",
          )}
        >
          {operation.method}
        </span>
        <code className="flex-1 truncate text-xs">{operation.path}</code>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">{operation.summary}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border px-3 py-3">
          {operation.summary && <p className="text-sm font-medium">{operation.summary}</p>}
          {operation.description && (
            <p className="mt-1 text-sm text-muted-foreground">{operation.description}</p>
          )}

          {operation.parameters && operation.parameters.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Parameters
              </p>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {operation.parameters.map((param) => (
                  <div key={`${param.in}-${param.name}`} className="flex items-start gap-2 text-xs">
                    <code className="rounded bg-secondary px-1 py-0.5">{param.name}</code>
                    <span className="text-muted-foreground">
                      {param.in}
                      {param.required ? " · required" : ""}
                      {param.description ? ` — ${param.description}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {operation.requestBody != null && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Request body
              </p>
              <pre className="mt-1.5 max-h-64 overflow-auto rounded-lg bg-secondary/60 p-2 text-[11px]">
                {JSON.stringify(operation.requestBody, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  const { data: document, isLoading, error } = useOpenApiDocument();
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    if (!document) return [];
    const operations = flattenOperations(document);
    const filtered = search
      ? operations.filter(
          (op) =>
            op.path.toLowerCase().includes(search.toLowerCase()) ||
            op.summary?.toLowerCase().includes(search.toLowerCase()),
        )
      : operations;

    const byTag = new Map<string, OpenApiOperation[]>();
    for (const op of filtered) {
      const tag = op.tags?.[0] ?? "Other";
      byTag.set(tag, [...(byTag.get(tag) ?? []), op]);
    }
    return Array.from(byTag.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [document, search]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">API Reference</h2>
          <p className="text-sm text-muted-foreground">
            Generated live from the running API&apos;s OpenAPI 3.1 document
            {document ? ` — v${document.info.version}` : ""}.
          </p>
        </div>
      </div>

      <div className="relative mt-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by path or summary…"
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="mt-4 flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-secondary/60" />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4">
          <EmptyState icon={BookOpen} title="Couldn't load the API reference" description={String(error)} />
        </div>
      )}

      {!isLoading && !error && groups.length === 0 && (
        <div className="mt-4">
          <EmptyState icon={BookOpen} title="No matching endpoints" description="Try a different search." />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {groups.map(([tag, operations]) => (
          <div key={tag}>
            <h3 className="mb-2 text-sm font-semibold">{tag}</h3>
            <div className="flex flex-col gap-2">
              {operations.map((operation) => (
                <OperationRow key={`${operation.method}-${operation.path}`} operation={operation} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
