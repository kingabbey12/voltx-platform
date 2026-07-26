"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Search as SearchIcon,
  FileText,
  Loader2,
  Sparkles,
  ChevronRight,
  MessageSquare,
  BookOpen,
  User,
  Building2,
  Calendar,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useKnowledgeSearch } from "@/hooks/use-knowledge";

function getResultIcon(sourceType: string) {
  switch (sourceType) {
    case "NOTE": return BookOpen;
    case "DOCUMENT": return FileText;
    case "CONTACT": return User;
    case "COMPANY": return Building2;
    case "OPPORTUNITY": return MessageSquare;
    case "ACTIVITY": return Calendar;
    case "AI_MEMORY": return Sparkles;
    case "CRM_CONTACT": return User;
    case "CRM_COMPANY": return Building2;
    case "CRM_OPPORTUNITY": return MessageSquare;
    case "CRM_ACTIVITY": return Calendar;
    default: return Database;
  }
}

function getResultColor(sourceType: string) {
  switch (sourceType) {
    case "NOTE": return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "DOCUMENT": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "CONTACT": case "CRM_CONTACT": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "COMPANY": case "CRM_COMPANY": return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
    case "OPPORTUNITY": case "CRM_OPPORTUNITY": return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
    case "ACTIVITY": case "CRM_ACTIVITY": return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";
    case "AI_MEMORY": return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function KnowledgeSearchPage() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(10);
  const [minConfidence, setMinConfidence] = useState(0.3);
  const [searched, setSearched] = useState(false);
  const search = useKnowledgeSearch();

  async function handleSearch() {
    if (!query.trim()) return;
    setSearched(true);
    await search.mutateAsync({
      query: query.trim(),
      topK,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  const results = search.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Semantic search across your entire knowledge index.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search your knowledge index..."
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <Button onClick={handleSearch} isLoading={search.isPending}>
              <SearchIcon className="h-4 w-4" />
              Search
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Results:
              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="h-7 rounded border border-border bg-background px-2 text-xs outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Min confidence:
              <select
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="h-7 rounded border border-border bg-background px-2 text-xs outline-none"
              >
                <option value={0.3}>0.3</option>
                <option value={0.5}>0.5</option>
                <option value={0.7}>0.7</option>
                <option value={0.9}>0.9</option>
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      {search.isPending && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {searched && !search.isPending && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <SearchIcon className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">No results found</p>
          <p className="text-xs text-muted-foreground/60">
            Try a different search term or lower the confidence threshold.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Found {results.length} result{results.length !== 1 ? "s" : ""}
          </p>
          {results.map((result, idx) => (
            <motion.div
              key={result.chunkId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Card className="transition-shadow hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", getResultColor(result.citation.sourceType))}>
                      {React.createElement(getResultIcon(result.citation.sourceType), { className: "h-4 w-4" })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{result.citation.documentTitle}</p>
                        <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium", getResultColor(result.citation.sourceType))}>
                          {result.citation.sourceType.toLowerCase()}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {(result.confidence * 100).toFixed(0)}% match
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                        &ldquo;{result.content}&rdquo;
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground/60">
                        <span>Source: {result.citation.sourceName}</span>
                        {result.semanticScore !== null && (
                          <span>Semantic: {(result.semanticScore * 100).toFixed(0)}%</span>
                        )}
                        {result.keywordScore !== null && (
                          <span>Keyword: {(result.keywordScore * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
