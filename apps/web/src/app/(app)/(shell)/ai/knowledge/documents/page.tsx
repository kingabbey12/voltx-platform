"use client";

import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
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
  useKnowledgeDocuments,
  useIngestDocument,
  useDeleteKnowledgeDocument,
} from "@/hooks/use-knowledge";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  INDEXED: CheckCircle2,
  INDEXING: Loader2,
  FAILED: XCircle,
  PENDING: Clock,
};

const STATUS_COLOR: Record<string, string> = {
  INDEXED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  INDEXING: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  FAILED: "bg-red-500/10 text-red-600 dark:text-red-400",
  PENDING: "bg-muted text-muted-foreground",
};

export default function KnowledgeDocumentsPage() {
  const { data, isLoading } = useKnowledgeDocuments({ limit: 50 });
  const ingestDoc = useIngestDocument();
  const deleteDoc = useDeleteKnowledgeDocument();

  const [ingestOpen, setIngestOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleIngest() {
    if (!sourceId.trim() || !title.trim() || !content.trim()) {
      toast.error("Source ID, title, and content are required");
      return;
    }
    try {
      const file = fileRef.current?.files?.[0];
      let fileBase64: string | undefined;
      if (file) {
        fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      await ingestDoc.mutateAsync({
        sourceId: sourceId.trim(),
        title: title.trim(),
        contentType: file?.type || "text/plain",
        text: content.trim(),
        fileBase64,
      });
      setIngestOpen(false);
      setSourceId("");
      setTitle("");
      setContent("");
      toast.success("Document ingested");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteDoc.mutateAsync(deleteId);
      setDeleteId(null);
      toast.success("Document deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Documents indexed into the knowledge graph.
          </p>
        </div>
        <Button onClick={() => setIngestOpen(true)}>
          <Upload className="h-4 w-4" />
          Ingest
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          )}

          {!isLoading && (!data?.items || data.items.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No documents</p>
              <p className="text-xs text-muted-foreground/60">
                Ingest a document to add it to the knowledge index.
              </p>
              <Button size="sm" className="mt-2" onClick={() => setIngestOpen(true)}>
                <Upload className="h-4 w-4" />
                Ingest Document
              </Button>
            </div>
          )}

          {data?.items && data.items.length > 0 && (
            <div className="divide-y divide-border">
              {data.items.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.contentType}{doc.externalId ? ` \u00B7 ${doc.externalId}` : ""}
                    </p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_COLOR[doc.status] ?? "")}>
                    {React.createElement(STATUS_ICON[doc.status] ?? Clock, { className: "h-3 w-3" })}
                    {doc.status.toLowerCase()}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(doc.id)}
                    aria-label="Delete document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ingest dialog */}
      <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ingest Document</DialogTitle>
            <DialogDescription>
              Add a document to the knowledge index for semantic search and graph linking.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Source ID</label>
              <input
                type="text"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                placeholder="Source UUID"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Product Requirements Doc"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Document text content..."
                className="h-28 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">File (optional)</label>
              <input
                ref={fileRef}
                type="file"
                className="w-full text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIngestOpen(false); setSourceId(""); setTitle(""); setContent(""); }}>Cancel</Button>
            <Button onClick={handleIngest} isLoading={ingestDoc.isPending}>Ingest</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              This will permanently remove this document from the knowledge index. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} isLoading={deleteDoc.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
