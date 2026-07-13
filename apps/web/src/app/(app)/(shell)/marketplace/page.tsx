"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Star, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePublishedApps } from "@/hooks/use-marketplace";

const CATEGORIES = ["PRODUCTIVITY", "ANALYTICS", "COMMUNICATION", "SALES", "FINANCE", "OTHER"];

function formatPrice(priceCents: number | null): string {
  if (priceCents === null) return "";
  return priceCents === 0 ? "Free" : `$${(priceCents / 100).toFixed(2)}`;
}

export default function MarketplaceBrowsePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const { data, isLoading } = usePublishedApps({ search: search || undefined, category, limit: 40 });

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search apps..."
            className="pl-9"
          />
        </div>
        <Select value={category ?? "ALL"} onValueChange={(value) => setCategory(value === "ALL" ? undefined : value)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0) + cat.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-card bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <EmptyState
            icon={Store}
            title="No apps found"
            description="Try a different search term or category."
          />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((app) => (
              <Link key={app.id} href={`/marketplace/${app.id}`} className="group block h-full">
                <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 text-sm font-semibold text-primary">
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                    <Badge variant="secondary">{app.category}</Badge>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-foreground">{app.name}</h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                    {app.description ?? "No description provided."}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                      {app.reviewCount > 0 ? app.averageRating.toFixed(1) : "No reviews"}
                    </span>
                    <span className="font-medium text-foreground">{formatPrice(app.priceCents)}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
