"use client";

import { useState } from "react";
import { KeyRound, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { formatRelativeTime } from "@/lib/format";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import {
  useCreateWorkflowSecret,
  useDeleteWorkflowSecret,
  useRotateWorkflowSecret,
  useWorkflowSecrets,
} from "@/hooks/use-workflows";

export default function WorkflowSecretsPage() {
  const { data, isLoading } = useWorkflowSecrets();
  const createSecret = useCreateWorkflowSecret();
  const rotateSecret = useRotateWorkflowSecret();
  const deleteSecret = useDeleteWorkflowSecret();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [rotateId, setRotateId] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");

  async function handleCreate() {
    try {
      await createSecret.mutateAsync({ key, value, description: description || undefined });
      toast.success("Secret created");
      setDialogOpen(false);
      setKey("");
      setValue("");
      setDescription("");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleRotate() {
    if (!rotateId) return;
    try {
      await rotateSecret.mutateAsync({ id: rotateId, value });
      toast.success("Secret rotated");
      setRotateId(null);
      setValue("");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSecret.mutateAsync(id);
      toast.success("Secret deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <PageHeader
        title="Secrets"
        description="Encrypted values workflows can reference — values are never shown once saved."
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New secret
          </Button>
        }
      />

      {!isLoading && data?.length === 0 && (
        <EmptyState
          icon={KeyRound}
          title="No secrets yet"
          description="Store an API key or credential for workflows to use securely."
          className="mt-6"
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New secret
            </Button>
          }
        />
      )}

      {!isLoading && data && data.length > 0 && (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Last rotated</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((secret) => (
              <TableRow key={secret.id}>
                <TableCell className="font-mono text-xs">{secret.key}</TableCell>
                <TableCell className="text-muted-foreground">{secret.description ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {secret.lastRotatedAt ? formatRelativeTime(secret.lastRotatedAt) : "Never"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {secret.lastUsedAt ? formatRelativeTime(secret.lastUsedAt) : "Never"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setRotateId(secret.id)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(secret.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New secret</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="secret-key">Key</Label>
              <Input id="secret-key" placeholder="STRIPE_API_KEY" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="secret-value">Value</Label>
              <Input id="secret-value" type="password" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="secret-description">Description (optional)</Label>
              <Textarea id="secret-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} isLoading={createSecret.isPending} disabled={!key || !value}>
              Create secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rotateId} onOpenChange={(open) => !open && setRotateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate secret</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rotate-value">New value</Label>
            <Input id="rotate-value" type="password" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateId(null)}>
              Cancel
            </Button>
            <Button onClick={handleRotate} isLoading={rotateSecret.isPending} disabled={!value}>
              Rotate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
