"use client";

import { useEffect, useState } from "react";
import { AlertCircle, FileText, ImageIcon, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingUpload } from "@/hooks/use-attachments";
import { attachmentsApi } from "@/lib/api/attachments";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ThumbnailPreview({ attachmentId }: { attachmentId: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    attachmentsApi
      .fetchThumbnailBlob(attachmentId)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => {
        // No thumbnail (non-image attachment) — icon fallback below covers this.
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachmentId]);

  if (!objectUrl) return null;
  // eslint-disable-next-line @next/next/no-img-element -- object URL from an authenticated blob fetch, not a static/remote asset next/image can optimize.
  return <img src={objectUrl} alt="" className="h-full w-full object-cover" />;
}

function UploadChip({
  upload,
  onRetry,
  onRemove,
}: {
  upload: PendingUpload;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const isImage = upload.file.type.startsWith("image/");

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-1.5 pr-2 text-xs">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary text-muted-foreground">
        {upload.status === "done" && upload.attachment && upload.attachment.hasThumbnail ? (
          <ThumbnailPreview attachmentId={upload.attachment.id} />
        ) : isImage ? (
          <ImageIcon className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 max-w-[140px]">
        <p className="truncate font-medium">{upload.file.name}</p>
        {upload.status === "uploading" && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round(upload.progress * 100)}%` }}
            />
          </div>
        )}
        {upload.status === "processing" && (
          <p className="text-[11px] text-muted-foreground">Processing...</p>
        )}
        {upload.status === "error" && (
          <p className="flex items-center gap-1 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            {upload.error ?? "Upload failed"}
          </p>
        )}
        {upload.status === "done" && (
          <p className="text-[11px] text-muted-foreground">{formatBytes(upload.file.size)}</p>
        )}
      </div>

      {upload.status === "error" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onRetry}
          aria-label="Retry upload"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onRemove}
        aria-label={upload.status === "uploading" ? "Cancel upload" : "Remove attachment"}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function AttachmentChipList({
  uploads,
  onRetry,
  onRemove,
  className,
}: {
  uploads: PendingUpload[];
  onRetry: (localId: string) => void;
  onRemove: (localId: string) => void;
  className?: string;
}) {
  if (uploads.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {uploads.map((upload) => (
        <UploadChip
          key={upload.localId}
          upload={upload}
          onRetry={() => onRetry(upload.localId)}
          onRemove={() => onRemove(upload.localId)}
        />
      ))}
    </div>
  );
}

/** Wraps children in a full-size drop zone that highlights on drag-over and forwards dropped files. Doesn't render any of its own visible chrome besides the overlay. */
export function AttachmentDropZone({
  onFilesDropped,
  children,
  className,
}: {
  onFilesDropped: (files: FileList) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [isDragActive, setIsDragActive] = useState(false);

  return (
    <div
      className={cn("relative", className)}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragActive(false);
        if (e.dataTransfer.files.length > 0) {
          onFilesDropped(e.dataTransfer.files);
        }
      }}
    >
      {children}
      {isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/5">
          <p className="text-sm font-medium text-primary">Drop files to attach</p>
        </div>
      )}
    </div>
  );
}
