"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bot,
  MessageSquare,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useConversations, useCreateConversation, useUpdateConversation, useDeleteConversation } from "@/hooks/use-ai";
import { formatRelativeTime } from "@/lib/format";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";

export function ConversationList() {
  const router = useRouter();
  const params = useParams();
  const activeId = params?.id as string | undefined;
  const [search, setSearch] = useState("");
  const { data, isLoading } = useConversations({ search: search || undefined, limit: 50 });
  const createConversation = useCreateConversation();
  const updateConversation = useUpdateConversation();
  const deleteConversation = useDeleteConversation();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function startNewChat() {
    try {
      const conversation = await createConversation.mutateAsync({});
      router.push(`/ai/${conversation.id}`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  function startRename(id: string, currentTitle: string) {
    setRenamingId(id);
    setRenameValue(currentTitle);
  }

  async function confirmRename() {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await updateConversation.mutateAsync({ id: renamingId, title: renameValue.trim() });
      setRenamingId(null);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      await deleteConversation.mutateAsync(deletingId);
      if (activeId === deletingId) {
        router.push("/ai");
      }
      setDeletingId(null);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const today = new Date();
  const todayStr = today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  function groupLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const dStr = d.toDateString();
    if (dStr === todayStr) return "Today";
    if (dStr === yesterdayStr) return "Yesterday";
    const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return "Previous Week";
    return "Older";
  }

  const grouped = data?.items.reduce<Record<string, typeof data.items>>((acc, c) => {
    const label = groupLabel(c.updatedAt);
    (acc[label] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-start gap-2 px-2 text-sm font-medium"
          onClick={startNewChat}
          isLoading={createConversation.isPending}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="h-8 w-full rounded-md border border-border bg-transparent pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 py-2">
          {isLoading && (
            <div className="flex flex-col gap-1.5 px-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          )}

          {!isLoading && (!grouped || Object.keys(grouped).length === 0) && (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Bot className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                {search ? "No conversations match your search" : "No conversations yet"}
              </p>
            </div>
          )}

          {grouped && Object.entries(grouped).map(([label, conversations]) => (
            <div key={label}>
              <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              {conversations.map((conversation) => (
                <motion.div
                  key={conversation.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="group relative"
                >
                  {renamingId === conversation.id ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); confirmRename(); }}
                      onBlur={confirmRename}
                      className="px-2 py-1"
                    >
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        className="h-7 w-full rounded-md border border-primary bg-background px-2 text-xs outline-none"
                        onKeyDown={(e) => e.key === "Escape" && setRenamingId(null)}
                      />
                    </form>
                  ) : (
                    <button
                      onClick={() => router.push(`/ai/${conversation.id}`)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                        activeId === conversation.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 truncate">{conversation.title}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100">
                        {formatRelativeTime(conversation.updatedAt)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-secondary group-hover:opacity-100"
                            aria-label="Conversation actions"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); startRename(conversation.id, conversation.title); }}>
                            <PenLine className="h-3.5 w-3.5" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setDeletingId(conversation.id); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation</DialogTitle>
            <DialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              isLoading={deleteConversation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
