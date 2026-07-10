import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attachmentsApi, type Attachment, type AttachmentReferenceType } from "@/lib/api/attachments";

export interface PendingUpload {
  localId: string;
  file: File;
  status: "uploading" | "processing" | "done" | "error";
  progress: number;
  attachment?: Attachment;
  error?: string;
}

const PROCESSING_POLL_INTERVAL_MS = 800;
const PROCESSING_POLL_TIMEOUT_MS = 30000;

/**
 * Owns the client-side upload queue for the AI composer's attach flow:
 * add (drag-drop/picker/paste all funnel here), retry, cancel, remove.
 * Each file uploads independently and immediately on add — nothing waits
 * for "send"; the composer just reads `readyAttachmentIds` when the user
 * hits send and clears the queue after.
 *
 * A file transitions uploading -> processing -> done. The HTTP upload
 * call resolving only means bytes were transferred; the backend still
 * runs virus-scan/thumbnail/text-extraction afterward
 * (attachment-processing.service.ts), so "processing" polls the
 * attachment's status until it's READY (or FAILED/QUARANTINED) before
 * counting it in `readyAttachmentIds` — otherwise the AI would receive a
 * "still processing" placeholder instead of the real file content for
 * any file attached and sent in quick succession.
 */
export function useAttachmentUploads() {
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const controllersRef = useRef(new Map<string, AbortController>());
  const cancelledRef = useRef(new Set<string>());

  const pollUntilProcessed = useCallback((localId: string, attachment: Attachment) => {
    const deadline = Date.now() + PROCESSING_POLL_TIMEOUT_MS;

    const poll = () => {
      if (cancelledRef.current.has(localId)) {
        return;
      }
      attachmentsApi
        .get(attachment.id)
        .then((updated) => {
          if (cancelledRef.current.has(localId)) return;

          if (updated.status === "READY") {
            setUploads((prev) =>
              prev.map((u) =>
                u.localId === localId ? { ...u, status: "done", attachment: updated, progress: 1 } : u,
              ),
            );
            return;
          }
          if (updated.status === "QUARANTINED" || updated.status === "FAILED") {
            setUploads((prev) =>
              prev.map((u) =>
                u.localId === localId
                  ? {
                      ...u,
                      status: "error",
                      error:
                        updated.status === "QUARANTINED"
                          ? "This file failed a security scan and can't be attached."
                          : "Processing this file failed.",
                    }
                  : u,
              ),
            );
            return;
          }
          if (Date.now() > deadline) {
            setUploads((prev) =>
              prev.map((u) =>
                u.localId === localId
                  ? { ...u, status: "error", error: "Timed out waiting for the file to finish processing." }
                  : u,
              ),
            );
            return;
          }
          setTimeout(poll, PROCESSING_POLL_INTERVAL_MS);
        })
        .catch(() => {
          if (cancelledRef.current.has(localId)) return;
          setTimeout(poll, PROCESSING_POLL_INTERVAL_MS);
        });
    };

    poll();
  }, []);

  const runUpload = useCallback(
    (localId: string, file: File) => {
      const controller = new AbortController();
      controllersRef.current.set(localId, controller);
      cancelledRef.current.delete(localId);

      attachmentsApi
        .upload(
          file,
          (fraction) => {
            setUploads((prev) =>
              prev.map((u) => (u.localId === localId ? { ...u, progress: fraction } : u)),
            );
          },
          controller.signal,
        )
        .then((attachment) => {
          if (cancelledRef.current.has(localId)) return;
          setUploads((prev) =>
            prev.map((u) =>
              u.localId === localId ? { ...u, status: "processing", attachment, progress: 1 } : u,
            ),
          );
          pollUntilProcessed(localId, attachment);
        })
        .catch((error: unknown) => {
          if (cancelledRef.current.has(localId)) return;
          const message = error instanceof Error ? error.message : "Upload failed";
          setUploads((prev) =>
            prev.map((u) => (u.localId === localId ? { ...u, status: "error", error: message } : u)),
          );
        })
        .finally(() => controllersRef.current.delete(localId));
    },
    [pollUntilProcessed],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const next: PendingUpload[] = Array.from(files).map((file) => ({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: "uploading",
        progress: 0,
      }));
      setUploads((prev) => [...prev, ...next]);
      next.forEach((u) => runUpload(u.localId, u.file));
    },
    [runUpload],
  );

  const retry = useCallback(
    (localId: string) => {
      const upload = uploads.find((u) => u.localId === localId);
      if (!upload) return;
      cancelledRef.current.delete(localId);
      setUploads((prev) =>
        prev.map((u) => (u.localId === localId ? { ...u, status: "uploading", progress: 0, error: undefined } : u)),
      );
      runUpload(localId, upload.file);
    },
    [uploads, runUpload],
  );

  const cancel = useCallback((localId: string) => {
    cancelledRef.current.add(localId);
    controllersRef.current.get(localId)?.abort();
    setUploads((prev) => prev.filter((u) => u.localId !== localId));
  }, []);

  const remove = useCallback((localId: string) => {
    cancelledRef.current.add(localId);
    controllersRef.current.get(localId)?.abort();
    setUploads((prev) => prev.filter((u) => u.localId !== localId));
  }, []);

  const reset = useCallback(() => {
    setUploads([]);
  }, []);

  const readyAttachmentIds = uploads
    .filter((u) => u.status === "done" && u.attachment)
    .map((u) => u.attachment!.id);

  // Covers both "bytes still transferring" and "backend still scanning/
  // extracting" — Send must stay disabled through both, not just the first.
  const isUploading = uploads.some((u) => u.status === "uploading" || u.status === "processing");

  return { uploads, addFiles, retry, cancel, remove, reset, readyAttachmentIds, isUploading };
}

export function useAttachmentsByReference(referenceType: AttachmentReferenceType, referenceId: string) {
  return useQuery({
    queryKey: ["attachments", referenceType, referenceId],
    queryFn: () => attachmentsApi.list(referenceType, referenceId),
    enabled: Boolean(referenceId),
  });
}

export function useAttachment(id: string | undefined) {
  return useQuery({
    queryKey: ["attachments", "detail", id],
    queryFn: () => attachmentsApi.get(id as string),
    enabled: Boolean(id),
    // Attachments finish processing (PENDING/PROCESSING -> READY) within a
    // couple of seconds — poll briefly rather than making the caller
    // manually refetch to find out when a preview/thumbnail becomes ready.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "PROCESSING" ? 1500 : false;
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attachmentsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attachments"] }),
  });
}

export function useAddAttachmentReference() {
  return useMutation({
    mutationFn: ({
      id,
      referenceType,
      referenceId,
    }: {
      id: string;
      referenceType: AttachmentReferenceType;
      referenceId: string;
    }) => attachmentsApi.addReference(id, referenceType, referenceId),
  });
}
