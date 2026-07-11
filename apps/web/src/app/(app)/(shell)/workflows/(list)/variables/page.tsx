"use client";

import { useState } from "react";
import { Braces, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import {
  useCreateOrgWorkflowVariable,
  useDeleteWorkflowVariable,
  useOrgWorkflowVariables,
} from "@/hooks/use-workflows";
import type { WorkflowVariableType } from "@/lib/api/workflows";

export default function WorkflowVariablesPage() {
  const { data, isLoading } = useOrgWorkflowVariables();
  const createVariable = useCreateOrgWorkflowVariable();
  const deleteVariable = useDeleteWorkflowVariable();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [key, setKey] = useState("");
  const [type, setType] = useState<WorkflowVariableType>("STRING");
  const [defaultValue, setDefaultValue] = useState("");
  const [description, setDescription] = useState("");

  async function handleCreate() {
    try {
      let parsedDefault: unknown = defaultValue || undefined;
      if (defaultValue && type === "NUMBER") parsedDefault = Number(defaultValue);
      if (defaultValue && type === "BOOLEAN") parsedDefault = defaultValue === "true";
      if (defaultValue && type === "JSON") parsedDefault = JSON.parse(defaultValue);

      await createVariable.mutateAsync({ key, type, defaultValue: parsedDefault, description: description || undefined });
      toast.success("Variable created");
      setDialogOpen(false);
      setKey("");
      setDefaultValue("");
      setDescription("");
      setType("STRING");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteVariable.mutateAsync(id);
      toast.success("Variable deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <PageHeader
        title="Variables"
        description="Organization-wide values workflows can reference as {{variables.key}}."
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New variable
          </Button>
        }
      />

      {!isLoading && data?.length === 0 && (
        <EmptyState
          icon={Braces}
          title="No variables yet"
          description="Define a shared value once and reuse it across every workflow."
          className="mt-6"
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New variable
            </Button>
          }
        />
      )}

      {!isLoading && data && data.length > 0 && (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Default value</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((variable) => (
              <TableRow key={variable.id}>
                <TableCell className="font-mono text-xs">{variable.key}</TableCell>
                <TableCell>
                  <Badge variant="outline">{variable.type}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {variable.defaultValue !== null && variable.defaultValue !== undefined
                    ? JSON.stringify(variable.defaultValue)
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{variable.description ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(variable.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New variable</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="var-key">Key</Label>
              <Input id="var-key" placeholder="support_email" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as WorkflowVariableType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STRING">String</SelectItem>
                  <SelectItem value="NUMBER">Number</SelectItem>
                  <SelectItem value="BOOLEAN">Boolean</SelectItem>
                  <SelectItem value="JSON">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="var-default">Default value (optional)</Label>
              <Input id="var-default" value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="var-description">Description (optional)</Label>
              <Textarea id="var-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} isLoading={createVariable.isPending} disabled={!key}>
              Create variable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
