import { API_BASE_URL } from "@/config/env";
import { tokenStorage } from "./token-storage";
import { apiClient } from "./client";
import { ApiError } from "./api-error";
import type { ApiEnvelope, PaginatedResult } from "./types";

export type AttachmentStatus = "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "QUARANTINED" | "FAILED";

export type AttachmentReferenceType =
  | "AI_CONVERSATION"
  | "AI_MESSAGE"
  | "CRM_CONTACT"
  | "CRM_COMPANY"
  | "CRM_LEAD"
  | "CRM_OPPORTUNITY"
  | "CRM_ACTIVITY"
  | "COMMS_MESSAGE";

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: AttachmentStatus;
  width: number | null;
  height: number | null;
  hasThumbnail: boolean;
  createdAt: string;
}

// 8MB — must match backend MULTIPART_PART_SIZE_BYTES (attachment.service.ts).
const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024;
// Files at or above this size use multipart upload instead of a single request.
const MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024;

/**
 * Real upload progress requires XMLHttpRequest — fetch() has no upload
 * progress event. Used by both the single-shot and per-part multipart
 * upload paths below.
 */
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    const accessToken = tokenStorage.readAccessToken();
    if (accessToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      let json: ApiEnvelope<unknown> | null = null;
      try {
        json = JSON.parse(xhr.responseText) as ApiEnvelope<unknown>;
      } catch {
        // handled by the ok-check below
      }
      if (xhr.status >= 200 && xhr.status < 300 && json?.success) {
        resolvePromise(json.data);
      } else {
        const errorEnvelope = json && !json.success ? json : null;
        reject(
          new ApiError(
            errorEnvelope?.error.message ?? `Upload failed with status ${xhr.status}`,
            xhr.status,
            errorEnvelope?.error.code ?? null,
          ),
        );
      }
    };

    xhr.onerror = () => reject(new ApiError("Network request failed", null));
    xhr.onabort = () => reject(new ApiError("Upload cancelled", null, "CANCELLED"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort());
    }

    xhr.send(formData);
  });
}

async function uploadMultipart(
  file: File,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Attachment> {
  const initiated = await apiClient.post<{ attachmentId: string; uploadId: string; partSizeBytes: number }>(
    "/attachments/multipart/initiate",
    { fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size },
  );

  const partSize = initiated.partSizeBytes || MULTIPART_PART_SIZE_BYTES;
  const totalParts = Math.ceil(file.size / partSize);
  const parts: Array<{ partNumber: number; etag: string }> = [];
  let uploadedBytes = 0;

  try {
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      if (signal?.aborted) {
        throw new ApiError("Upload cancelled", null, "CANCELLED");
      }
      const start = (partNumber - 1) * partSize;
      const chunk = file.slice(start, start + partSize);
      const formData = new FormData();
      formData.append("file", chunk, file.name);

      const result = (await uploadWithProgress(
        `${API_BASE_URL}/attachments/multipart/${initiated.attachmentId}/parts/${partNumber}?uploadId=${initiated.uploadId}`,
        formData,
        (fraction) => {
          if (onProgress) {
            const overallBytes = uploadedBytes + fraction * chunk.size;
            onProgress(overallBytes / file.size);
          }
        },
        signal,
      )) as { partNumber: number; etag: string };

      parts.push(result);
      uploadedBytes += chunk.size;
      onProgress?.(uploadedBytes / file.size);
    }

    return await apiClient.post<Attachment>(
      `/attachments/multipart/${initiated.attachmentId}/complete?uploadId=${initiated.uploadId}`,
      { parts },
    );
  } catch (error) {
    await apiClient
      .post(`/attachments/multipart/${initiated.attachmentId}/abort?uploadId=${initiated.uploadId}`)
      .catch(() => {
        // best-effort cleanup — the upload already failed for its own reason
      });
    throw error;
  }
}

export const attachmentsApi = {
  upload: (file: File, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<Attachment> => {
    if (file.size >= MULTIPART_THRESHOLD_BYTES) {
      return uploadMultipart(file, onProgress, signal);
    }
    const formData = new FormData();
    formData.append("file", file);
    return uploadWithProgress(`${API_BASE_URL}/attachments/upload`, formData, onProgress, signal) as Promise<Attachment>;
  },

  get: (id: string) => apiClient.get<Attachment>(`/attachments/${id}`),

  list: (referenceType: AttachmentReferenceType, referenceId: string) =>
    apiClient.get<PaginatedResult<Attachment>>("/attachments", {
      query: { referenceType, referenceId, limit: 100 },
    }),

  addReference: (id: string, referenceType: AttachmentReferenceType, referenceId: string) =>
    apiClient.post<{ linked: true }>(`/attachments/${id}/references`, { referenceType, referenceId }),

  delete: (id: string) => apiClient.delete<{ deleted: true }>(`/attachments/${id}`),

  downloadUrl: (id: string) =>
    apiClient.get<{ url: string; expiresAt: string }>(`/attachments/${id}/download-url`),

  /**
   * Authenticated binary fetch for inline previews (thumbnail/full image)
   * — `<img src>` can't attach an Authorization header, so callers use
   * this to fetch the blob and create an object URL client-side rather
   * than pointing an <img> straight at the API.
   */
  async fetchThumbnailBlob(id: string): Promise<Blob> {
    return fetchAuthenticatedBlob(`${API_BASE_URL}/attachments/${id}/thumbnail`);
  },

  async fetchFileBlob(id: string): Promise<Blob> {
    return fetchAuthenticatedBlob(`${API_BASE_URL}/attachments/${id}/download`);
  },
};

async function fetchAuthenticatedBlob(url: string): Promise<Blob> {
  const accessToken = tokenStorage.readAccessToken();
  const response = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!response.ok) {
    throw new ApiError(`Failed to fetch file (status ${response.status})`, response.status);
  }
  return response.blob();
}
