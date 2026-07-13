"use client";

import { Laptop } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRevokeTrustedDevice, useTrustedDevices } from "@/hooks/use-security";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatDate, formatRelativeTime } from "@/lib/format";

export default function TrustedDevicesPage() {
  const { data, isLoading } = useTrustedDevices();
  const revokeDevice = useRevokeTrustedDevice();

  async function onRevoke(id: string) {
    try {
      await revokeDevice.mutateAsync(id);
      toast.success("Trust revoked — this device will be MFA-challenged again");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold">Trusted devices</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Devices you chose to remember at login — MFA is skipped on these until trust expires.
        Trust a device from the MFA challenge screen at login.
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
          <EmptyState
            icon={Laptop}
            title="No trusted devices"
            description="You haven't marked any device as trusted yet."
          />
        )}

        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Trusted until</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.label ?? "Unnamed device"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(device.lastSeenAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(device.trustedUntil)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRevoke(device.id)}
                        isLoading={revokeDevice.isPending}
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
