"use client";

import { Monitor } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRevokeSession, useSessions } from "@/hooks/use-security";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatDate, formatRelativeTime } from "@/lib/format";

export default function SessionsPage() {
  const { data, isLoading } = useSessions();
  const revokeSession = useRevokeSession();

  async function onRevoke(id: string) {
    try {
      await revokeSession.mutateAsync(id);
      toast.success("Session revoked");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold">Active sessions</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every device currently signed in to your account within this organization. Revoking a
        session immediately rejects its refresh token.
      </p>

      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.length === 0 && (
          <EmptyState icon={Monitor} title="No active sessions" description="Nothing to show here." />
        )}

        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device / IP</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Signed in</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <p className="max-w-sm truncate text-sm text-foreground">
                      {session.userAgent ?? "Unknown device"}
                    </p>
                    <p className="text-xs text-muted-foreground">{session.ipAddress ?? "Unknown IP"}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(session.lastActiveAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(session.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRevoke(session.id)}
                        isLoading={revokeSession.isPending}
                      >
                        Revoke
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
