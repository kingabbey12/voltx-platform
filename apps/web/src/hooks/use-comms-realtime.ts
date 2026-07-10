"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/env";
import { tokenStorage } from "@/lib/api/token-storage";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { CommsMessage } from "@/lib/api/communications";

function wsOrigin(): string {
  // API_BASE_URL is e.g. "https://api.usevoltx.com/api/v1" — socket.io
  // connects to the origin + namespace, not the REST path.
  return new URL(API_BASE_URL).origin;
}

/**
 * Live push for the unified inbox — mount once near the shell root.
 * Mirrors the backend's CommsGateway contract exactly: JWT passed as
 * `auth.token` on connect, org-scoped room membership handled entirely
 * server-side, `message:new`/`message:status` events invalidate the
 * relevant TanStack Query caches so the UI updates without polling.
 */
export function useCommsRealtime(): void {
  const status = useAuthStore((state) => state.status);
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    const token = tokenStorage.readAccessToken();
    if (!token) return;

    const socket = io(`${wsOrigin()}/communications`, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("message:new", (message: CommsMessage) => {
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", message.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });

    socket.on("message:status", (payload: { id: string; status: string }) => {
      void payload;
      queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [status, queryClient]);
}
