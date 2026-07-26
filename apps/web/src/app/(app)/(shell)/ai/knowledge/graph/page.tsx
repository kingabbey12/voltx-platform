"use client";

import React, { useState } from "react";
import {
  Network,
  Loader2,
  FileText,
  Hash,
  User,
  Building2,
  MessageSquare,
  Calendar,
  BookOpen,
  Sparkles,
  Link2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTraverseGraph } from "@/hooks/use-knowledge";

const NODE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  NOTE: BookOpen,
  DOCUMENT: FileText,
  CONTACT: User,
  COMPANY: Building2,
  OPPORTUNITY: MessageSquare,
  ACTIVITY: Calendar,
  AI_MEMORY: Sparkles,
};

const NODE_COLORS: Record<string, string> = {
  NOTE: "border-amber-500/30 bg-amber-500/5",
  DOCUMENT: "border-blue-500/30 bg-blue-500/5",
  CONTACT: "border-emerald-500/30 bg-emerald-500/5",
  COMPANY: "border-violet-500/30 bg-violet-500/5",
  OPPORTUNITY: "border-rose-500/30 bg-rose-500/5",
  ACTIVITY: "border-cyan-500/30 bg-cyan-500/5",
  AI_MEMORY: "border-indigo-500/30 bg-indigo-500/5",
};

export default function KnowledgeGraphPage() {
  const [sourceType, setSourceType] = useState("NOTE");
  const [sourceId, setSourceId] = useState("");
  const [hops, setHops] = useState(2);
  const [params, setParams] = useState<{ type: string; externalId: string; hops?: number } | null>(null);

  const { data: nodes = [], isFetching, isLoading } = useTraverseGraph(params);

  function handleTraverse() {
    if (!sourceId.trim()) return;
    setParams({
      type: sourceType,
      externalId: sourceId.trim(),
      hops,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleTraverse();
  }

  const grouped = nodes.reduce<Record<string, typeof nodes>>((acc, n) => {
    const key = n.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge Graph</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore relationships between entities in the knowledge index.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Entity Type</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                {["NOTE", "DOCUMENT", "CONTACT", "COMPANY", "OPPORTUNITY", "ACTIVITY", "AI_MEMORY"].map((t) => (
                  <option key={t} value={t}>{t.toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Entity External ID</label>
              <input
                type="text"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. entity-uuid-here"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Hops</label>
              <select
                value={hops}
                onChange={(e) => setHops(Number(e.target.value))}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <Button onClick={handleTraverse} isLoading={isFetching}>
              <Network className="h-4 w-4" />
              Traverse
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {params && !isLoading && nodes.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Network className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">No relationships found</p>
          <p className="text-xs text-muted-foreground/60">
            No graph data for the given entity. Try a different ID or increase the hops.
          </p>
        </div>
      )}

      {nodes.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="h-4 w-4" />
            {nodes.length} node{nodes.length !== 1 ? "s" : ""} across {Object.keys(grouped).length} type{Object.keys(grouped).length !== 1 ? "s" : ""}
          </div>

          {Object.entries(grouped).map(([type, typeNodes]) => (
            <Card key={type}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  {React.createElement(NODE_ICONS[type] ?? Hash, { className: "h-4 w-4" })}
                  {type.toLowerCase()}
                </CardTitle>
                <span className="text-xs text-muted-foreground">{typeNodes.length} node{typeNodes.length !== 1 ? "s" : ""}</span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {typeNodes.map((node) => (
                    <div
                      key={node.id}
                      className={cn(
                        "border-l-2 px-4 py-3",
                        NODE_COLORS[node.type] ?? "border-border bg-background",
                      )}
                    >
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          {React.createElement(NODE_ICONS[node.type] ?? Hash, { className: "h-3.5 w-3.5" })}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{node.name}</p>
                          {node.externalId && (
                            <p className="truncate text-[11px] text-muted-foreground">ID: {node.externalId}</p>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Link2 className="h-3 w-3" />
                          {node.relationshipType.toLowerCase()}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          depth {node.depth}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
