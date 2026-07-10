"use client";

import { CheckCircle2, Link2, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  useChannelConnections,
  useDisconnectCommsConnection,
  useInitiateCommsOAuth,
} from "@/hooks/use-communications";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatRelativeTime } from "@/lib/format";
import { commsOAuthRedirectUri } from "@/lib/comms-oauth";
import type { CommsChannel } from "@/lib/api/communications";

const CONNECTABLE_CHANNELS: { channel: CommsChannel; label: string; icon: typeof Mail }[] = [
  { channel: "GMAIL", label: "Gmail", icon: Mail },
  { channel: "SLACK", label: "Slack", icon: MessageSquare },
];

const COMING_SOON: { channel: string; label: string }[] = [
  { channel: "OUTLOOK", label: "Outlook" },
  { channel: "WHATSAPP", label: "WhatsApp" },
  { channel: "TWILIO_SMS", label: "SMS" },
  { channel: "TWILIO_VOICE", label: "Voice" },
  { channel: "TEAMS", label: "Teams" },
];

export default function CommunicationsSettingsPage() {
  const { data, isLoading } = useChannelConnections();
  const initiateOAuth = useInitiateCommsOAuth();
  const disconnect = useDisconnectCommsConnection();

  const connectionsByChannel = new Map(data?.items.map((c) => [c.channel, c]));

  async function handleConnect(channel: CommsChannel, label: string) {
    try {
      const result = await initiateOAuth.mutateAsync({
        channel,
        displayName: label,
        redirectUri: commsOAuthRedirectUri(),
      });
      window.location.href = result.authorizationUrl;
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDisconnect(id: string) {
    try {
      await disconnect.mutateAsync(id);
      toast.success("Disconnected");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-medium">Connected channels</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Real OAuth connections that feed the unified inbox — messages appear in{" "}
          <span className="font-medium text-foreground">Inbox</span> as soon as they arrive.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isLoading &&
          [1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary/60" />)}

        {!isLoading &&
          CONNECTABLE_CHANNELS.map(({ channel, label, icon: Icon }) => {
            const connection = connectionsByChannel.get(channel);
            const isConnected = connection?.status === "CONNECTED";

            return (
              <Card key={channel} className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isConnected ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {isConnected ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Icon className="h-4.5 w-4.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    {isConnected ? (
                      <>
                        <p className="truncate text-xs text-success">Connected</p>
                        {connection?.externalAccountId && (
                          <p className="truncate text-xs text-muted-foreground">
                            {connection.externalAccountId}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {connection?.lastSyncAt
                            ? `Synced ${formatRelativeTime(connection.lastSyncAt)}`
                            : "Not yet synced"}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not connected</p>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  {isConnected && connection ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() => handleDisconnect(connection.id)}
                      isLoading={disconnect.isPending}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleConnect(channel, label)}
                      isLoading={initiateOAuth.isPending}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground">Coming soon</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          WhatsApp, SMS, and Voice need a Twilio/Meta account configured for this environment;
          Outlook and Teams need Microsoft OAuth credentials. Not connectable yet.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {COMING_SOON.map(({ channel, label }) => (
            <Card key={channel} className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{label}</p>
                  <p className="text-[10px] text-muted-foreground">Not connected</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
