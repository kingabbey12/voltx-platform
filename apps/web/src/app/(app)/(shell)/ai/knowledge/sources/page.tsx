"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Database,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  PauseCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useKnowledgeSources,
  useCreateKnowledgeSource,
  useUpdateKnowledgeSource,
  useDeleteKnowledgeSource,
  useReindexSource,
} from "@/hooks/use-knowledge";
import { type KnowledgeSourceType, type KnowledgeSourceStatus } from "@/lib/api/knowledge";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";

const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  CRM_CONTACT: "CRM Contact",
  CRM_COMPANY: "CRM Company",
  CRM_OPPORTUNITY: "CRM Opportunity",
  CRM_ACTIVITY: "CRM Activity",
  NOTE: "Note",
  DOCUMENT: "Document",
  EMAIL: "Email",
  CALENDAR: "Calendar",
  TASK: "Task",
  MEETING: "Meeting",
  UPLOADED_FILE: "Uploaded File",
  AI_MEMORY: "AI Memory",
  OTHER: "Other",
};

const SOURCE_TYPES: KnowledgeSourceType[] = [
  "NOTE", "DOCUMENT", "EMAIL", "CALENDAR", "TASK", "MEETING",
  "UPLOADED_FILE", "AI_MEMORY", "OTHER",
];

const STATUS_ICON: Record<KnowledgeSourceStatus, React.ComponentType<{ className?: string }>> = {
  ACTIVE: CheckCircle2,
  PAUSED: PauseCircle,
  ERROR: XCircle,
};

const STATUS_COLOR: Record<KnowledgeSourceStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PAUSED: "bg-muted text-muted-foreground",
  ERROR: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export default function KnowledgeSourcesPage() {
  const { data, isLoading } = useKnowledgeSources({ limit: 50 });
  const createSource = useCreateKnowledgeSource();
  const updateSource = useUpdateKnowledgeSource();
  const deleteSource = useDeleteKnowledgeSource();
  const reindexSource = useReindexSource();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", type: "OTHER" as KnowledgeSourceType, description: "" });
  const [editFormData, setEditFormData] = useState({ name: "", description: "" });

  function resetForm() {
    setFormData({ name: "", type: "OTHER", description: "" });
  }

  async function handleCreate() {
    if (!formData.name.trim()) {
      toast.error("Source name is required");
      return;
    }
    try {
      await createSource.mutateAsync({
        name: formData.name.trim(),
        type: formData.type,
        description: formData.description.trim() || undefined,
      });
      setCreateOpen(false);
      resetForm();
      toast.success("Source created");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteSource.mutateAsync(deleteId);
      setDeleteId(null);
      toast.success("Source deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  function startEdit(source: { id: string; name: string; description: string | null }) {
    setEditingId(source.id);
    setEditFormData({ name: source.name, description: source.description ?? "" });
  }

  async function handleEdit() {
    if (!editingId || !editFormData.name.trim()) return;
    try {
      await updateSource.mutateAsync({
        id: editingId,
        name: editFormData.name.trim(),
        description: editFormData.description.trim() || undefined,
      });
      setEditingId(null);
      toast.success("Source updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleReindex(id: string) {
    try {
      await reindexSource.mutateAsync(id);
      toast.success("Reindexing started");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Sources</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage data sources that feed your knowledge index.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          New Source
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          )}

          {!isLoading && (!data?.items || data.items.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Database className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No sources yet</p>
              <p className="text-xs text-muted-foreground/60">Create your first knowledge source to start indexing.</p>
              <Button size="sm" className="mt-2" onClick={() => { resetForm(); setCreateOpen(true); }}>
                <Plus className="h-4 w-4" />
                New Source
              </Button>
            </div>
          )}

          {data?.items && data.items.length > 0 && (
            <div className="divide-y divide-border">
              {data.items.map((source) => (
                <motion.div
                  key={source.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-4 px-4 py-3.5 text-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Database className="h-4.5 w-4.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {editingId === source.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData((p) => ({ ...p, name: e.target.value }))}
                          className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editFormData.description}
                          onChange={(e) => setEditFormData((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Description (optional)"
                          className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                        />
                        <Button size="sm" className="h-8 text-xs" onClick={handleEdit} isLoading={updateSource.isPending}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="truncate font-medium">{source.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {SOURCE_TYPE_LABELS[source.type] ?? source.type}
                          {source.description && ` \u2014 ${source.description}`}
                        </p>
                      </>
                    )}
                  </div>

                  {editingId !== source.id && (
                    <>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_COLOR[source.status])}>
                        {React.createElement(STATUS_ICON[source.status], { className: "h-3 w-3" })}
                        {source.status.toLowerCase()}
                      </span>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => startEdit(source)}
                          aria-label="Edit source"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => handleReindex(source.id)}
                          isLoading={reindexSource.isPending}
                          aria-label="Reindex source"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(source.id)}
                          aria-label="Delete source"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Knowledge Source</DialogTitle>
            <DialogDescription>
              A knowledge source represents a data origin for the knowledge index.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Product Documentation"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value as KnowledgeSourceType }))}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional description"
                className="h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} isLoading={createSource.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Source</DialogTitle>
            <DialogDescription>
              This will permanently delete this source and all its documents. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} isLoading={deleteSource.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
