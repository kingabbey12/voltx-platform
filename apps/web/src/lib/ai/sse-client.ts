import { API_BASE_URL } from "@/config/env";
import { tokenStorage } from "@/lib/api/token-storage";

export interface SseFrame {
  event: string;
  data: unknown;
}

/**
 * Authenticated Server-Sent Events reader for the backend's autonomous
 * agent run streaming endpoints. Browser EventSource can't send a POST
 * body or an Authorization header, so this reads the raw
 * fetch()+ReadableStream response and parses the wire format by hand:
 * `event: <name>\ndata: <json>\n\n` frames, matching formatSseEvent on
 * the backend (backend/src/modules/ai/streaming/sse-event.formatter.ts).
 */
export async function* streamSse(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<SseFrame> {
  const accessToken = tokenStorage.readAccessToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    let message = `Stream request failed with status ${response.status}`;
    try {
      const json = (await response.json()) as { error?: { message?: string } };
      message = json.error?.message ?? message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const rawFrame of frames) {
        const frame = parseFrame(rawFrame);
        if (frame) yield frame;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseFrame(rawFrame: string): SseFrame | null {
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of rawFrame.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (dataLines.length === 0) return null;

  try {
    return { event: eventName, data: JSON.parse(dataLines.join("\n")) as unknown };
  } catch {
    return { event: eventName, data: dataLines.join("\n") };
  }
}
