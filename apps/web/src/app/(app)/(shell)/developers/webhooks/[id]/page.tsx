"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useReplayWebhookDelivery,
  useWebhookDeliveries,
  useWebhookEndpoint,
} from "@/hooks/use-developer-portal";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatDate } from "@/lib/format";

const STATUS_VARIANT: Record<string, "success" | "destructive" | "secondary"> = {
  SUCCEEDED: "success",
  FAILED: "destructive",
  EXHAUSTED: "destructive",
  PENDING: "secondary",
};

export default function WebhookDeliveriesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: endpoint } = useWebhookEndpoint(params.id);
  const { data: deliveries, isLoading } = useWebhookDeliveries(params.id);
  const replayDelivery = useReplayWebhookDelivery();

  async function onReplay(deliveryId: string) {
    try {
      await replayDelivery.mutateAsync({ endpointId: params.id, deliveryId });
      toast.success("Replay queued as a new delivery");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => router.push("/developers/webhooks")}>
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to webhooks
      </Button>

      <div className="mt-3">
        <h2 className="text-base font-semibold font-mono">{endpoint?.url}</h2>
        <p className="text-sm text-muted-foreground">
          Delivery log — refreshes automatically every 10 seconds.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && deliveries?.length === 0 && (
          <EmptyState icon={History} title="No deliveries yet" description="They'll show up here as events fire." />
        )}

        {!isLoading && deliveries && deliveries.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="font-mono text-xs">{delivery.eventType}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[delivery.status] ?? "secondary"}>{delivery.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {delivery.responseStatusCode ?? "—"}
                  </TableCell>
                  <TableCell>{delivery.attemptCount}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(delivery.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReplay(delivery.id)}
                      isLoading={replayDelivery.isPending}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
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
