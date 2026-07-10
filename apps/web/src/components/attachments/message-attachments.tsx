"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { useAttachmentsByReference } from "@/hooks/use-attachments";
import { attachmentsApi, type Attachment } from "@/lib/api/attachments";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentThumb({ attachment }: { attachment: Attachment }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment.hasThumbnail) return;
    let cancelled = false;
    let url: string | null = null;
    attachmentsApi
      .fetchThumbnailBlob(attachment.id)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id, attachment.hasThumbnail]);

  async function handleDownload() {
    const blob = await attachmentsApi.fetchFileBlob(attachment.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="group flex items-center gap-2 rounded-lg border border-border bg-background/60 py-1.5 pl-1.5 pr-2.5 text-xs hover:bg-secondary"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary text-muted-foreground">
        {objectUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL from an authenticated blob fetch, not a static/remote asset next/image can optimize.
          <img src={objectUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 max-w-[140px] text-left">
        <p className="truncate font-medium">{attachment.fileName}</p>
        <p className="text-[11px] text-muted-foreground">{formatBytes(attachment.sizeBytes)}</p>
      </div>
      <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

export function MessageAttachments({ messageId, align }: { messageId: string; align: "start" | "end" }) {
  const { data } = useAttachmentsByReference("AI_MESSAGE", messageId);

  if (!data || data.items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", align === "end" ? "justify-end" : "justify-start")}>
      {data.items.map((attachment) => (
        <AttachmentThumb key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}
