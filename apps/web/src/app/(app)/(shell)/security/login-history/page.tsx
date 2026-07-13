"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLoginHistory } from "@/hooks/use-security";
import { formatDate } from "@/lib/format";

const LIMIT = 20;

export default function LoginHistoryPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useLoginHistory({ page, limit: LIMIT });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <h2 className="text-base font-semibold">Login history</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every successful sign-in to your account within this organization.
      </p>

      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <EmptyState icon={History} title="No login history" description="Nothing to show here yet." />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device / IP</TableHead>
                <TableHead>Signed in</TableHead>
                <TableHead>Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <p className="max-w-sm truncate text-sm text-foreground">
                      {entry.userAgent ?? "Unknown device"}
                    </p>
                    <p className="text-xs text-muted-foreground">{entry.ipAddress ?? "Unknown IP"}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(entry.createdAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(entry.lastActiveAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
