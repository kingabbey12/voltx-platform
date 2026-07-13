"use client";

import { useState } from "react";
import { CheckCircle2, Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDisableMfa,
  useRegenerateBackupCodes,
  useSetupMfa,
  useVerifyMfaSetup,
} from "@/hooks/use-security";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { useAuthStore } from "@/lib/stores/auth-store";

type DialogMode = "enroll-verify" | "disable" | null;

export default function MfaPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const setupMfa = useSetupMfa();
  const verifySetup = useVerifyMfaSetup();
  const disableMfa = useDisableMfa();
  const regenerateBackupCodes = useRegenerateBackupCodes();

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [pendingSetup, setPendingSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  async function refreshUser() {
    const me = await authApi.me();
    setUser(me);
  }

  async function onStartEnroll() {
    try {
      const result = await setupMfa.mutateAsync();
      setPendingSetup(result);
      setCode("");
      setDialogMode("enroll-verify");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onVerifyEnroll() {
    try {
      const result = await verifySetup.mutateAsync(code);
      setBackupCodes(result.backupCodes);
      setDialogMode(null);
      await refreshUser();
      toast.success("Multi-factor authentication enabled");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onDisable() {
    try {
      await disableMfa.mutateAsync(code);
      setDialogMode(null);
      setCode("");
      await refreshUser();
      toast.success("Multi-factor authentication disabled");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onRegenerateBackupCodes() {
    const promptedCode = window.prompt("Enter a current TOTP code or an unused backup code:");
    if (!promptedCode) return;
    try {
      const result = await regenerateBackupCodes.mutateAsync(promptedCode);
      setBackupCodes(result.backupCodes);
      toast.success("New backup codes issued — your old codes no longer work");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold">Multi-factor authentication</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add a second factor to your own login using any TOTP authenticator app.
      </p>

      <Card className="mt-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {user?.mfaEnabled ? (
              <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
            ) : (
              <ShieldOff className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-foreground">
                {user?.mfaEnabled ? "MFA is enabled" : "MFA is not enabled"}
              </p>
              <p className="text-sm text-muted-foreground">
                {user?.mfaEnabled
                  ? "You'll be asked for a code at every login from a new device."
                  : "Enable it to protect your account with a second factor."}
              </p>
            </div>
          </div>
          {user?.mfaEnabled ? (
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={onRegenerateBackupCodes}>
                New backup codes
              </Button>
              <Button variant="destructive" onClick={() => setDialogMode("disable")}>
                Disable
              </Button>
            </div>
          ) : (
            <Button onClick={onStartEnroll} isLoading={setupMfa.isPending}>
              Enable MFA
            </Button>
          )}
        </div>
      </Card>

      {/* Enroll: show secret + otpauth URI, then ask for a verification code */}
      <Dialog open={dialogMode === "enroll-verify"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable multi-factor authentication</DialogTitle>
            <DialogDescription>
              Add this account to your authenticator app, then enter the 6-digit code it shows.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label>Secret key (manual entry)</Label>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3">
                <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">
                  {pendingSetup?.secret}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (pendingSetup) {
                      void navigator.clipboard.writeText(pendingSetup.secret);
                      toast.success("Copied to clipboard");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Or open this link on the device with your authenticator app:{" "}
                <span className="break-all font-mono">{pendingSetup?.otpauthUrl}</span>
              </p>
            </div>
            <div>
              <Label htmlFor="verify-code">6-digit code</Label>
              <Input
                id="verify-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                maxLength={10}
                autoComplete="one-time-code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button onClick={onVerifyEnroll} isLoading={verifySetup.isPending} disabled={!code}>
              Verify & enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable */}
      <Dialog open={dialogMode === "disable"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable multi-factor authentication</DialogTitle>
            <DialogDescription>
              Enter a current code from your authenticator app, or an unused backup code.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="disable-code">Code</Label>
            <Input
              id="disable-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              maxLength={10}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDisable} isLoading={disableMfa.isPending} disabled={!code}>
              Disable MFA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup codes reveal */}
      <Dialog open={backupCodes !== null} onOpenChange={(open) => !open && setBackupCodes(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your backup codes</DialogTitle>
            <DialogDescription>
              Save these somewhere safe — each can be used once if you lose access to your
              authenticator app. They&apos;re shown exactly once.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/50 p-4">
            {backupCodes?.map((backupCode) => (
              <code key={backupCode} className="text-sm">
                {backupCode}
              </code>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (backupCodes) {
                  void navigator.clipboard.writeText(backupCodes.join("\n"));
                  toast.success("Copied to clipboard");
                }
              }}
              variant="outline"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy all
            </Button>
            <Button onClick={() => setBackupCodes(null)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
