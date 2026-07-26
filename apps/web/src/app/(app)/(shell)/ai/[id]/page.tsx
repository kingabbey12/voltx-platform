"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  Copy,
  CornerDownLeft,
  Menu,
  Paperclip,
  RefreshCw,
  StopCircle,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { AttachmentChipList, AttachmentDropZone } from "@/components/attachments/attachment-uploader";
import { MarkdownMessage } from "@/components/ai/markdown-message";
import {
  useConversation,
  useConversationMessages,
  useSendMessage,
  useUpdateConversation,
  useDeleteConversation,
} from "@/hooks/use-ai";
import { useAttachmentUploads } from "@/hooks/use-attachments";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";

interface StreamMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  isStreaming?: boolean;
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: conversation } = useConversation(id);
  const { data: messagesData, isLoading: messagesLoading } = useConversationMessages(id);
  const sendMessage = useSendMessage(id);
  const updateConversation = useUpdateConversation();
  const deleteConversation = useDeleteConversation();

  const [input, setInput] = useState("");
  const [streamingMessages, setStreamingMessages] = useState<StreamMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [retryMessageId, setRetryMessageId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { uploads, addFiles, retry, remove, reset, readyAttachmentIds, isUploading } =
    useAttachmentUploads();

  const allMessages: StreamMessage[] = [
    ...(messagesData?.items ?? []).map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.createdAt,
    })),
    ...streamingMessages,
  ];

  const scrollToBottom = useCallback((force = false) => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const threshold = force ? 0 : 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (force || atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: force ? "instant" : "smooth" });
      setShowScrollBtn(false);
    }
  }, []);

  useEffect(() => {
    if (streamContent || sendMessage.isPending) {
      scrollToBottom();
    }
  }, [streamContent, sendMessage.isPending, scrollToBottom]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messagesData?.items.length, scrollToBottom]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    function handleScroll() {
      const atBottom = (el as HTMLElement).scrollHeight - (el as HTMLElement).scrollTop - (el as HTMLElement).clientHeight < 100;
      setShowScrollBtn(!atBottom);
    }
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  async function handleSend() {
    const content = input.trim();
    if ((!content && readyAttachmentIds.length === 0) || isStreaming || isUploading) return;
    setInput("");
    reset();
    setRetryMessageId(null);

    const userMessage: StreamMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setStreamingMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamContent("");

    try {
      const result = await sendMessage.mutateAsync({ content, attachmentIds: readyAttachmentIds });

      setStreamingMessages((prev) => [
        ...prev.filter((m) => m.id !== userMessage.id),
        { ...userMessage, id: result.userMessage.id },
      ]);

      if (result.assistantMessage) {
        setStreamingMessages((prev) => [
          ...prev,
          {
            id: result.assistantMessage!.id,
            role: "assistant",
            content: result.assistantMessage!.content,
            createdAt: result.assistantMessage!.createdAt,
          },
        ]);
      }
      setIsStreaming(false);
      setStreamContent("");
    } catch (error) {
      const errMsg = friendlyErrorMessage(error);
      setStreamingMessages((prev) => [
        ...prev.filter((m) => m.id !== userMessage.id),
        { ...userMessage, id: `failed-${Date.now()}` },
      ]);
      setStreamingMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `**Error**: ${errMsg}\n\n_You can retry this message._`,
          createdAt: new Date().toISOString(),
        },
      ]);
      setIsStreaming(false);
      setStreamContent("");
      setInput(content);
    }
  }

  async function handleRetry() {
    if (!retryMessageId) return;
    const lastContent = input || allMessages.find((m) => m.id === retryMessageId)?.content || "";
    setStreamingMessages((prev) => prev.filter((m) => m.id !== retryMessageId));
    setInput(lastContent);
    setRetryMessageId(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setIsStreaming(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
    if (event.key === "Escape") {
      if (isStreaming) stopStreaming();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files);
    if (files.length > 0) {
      event.preventDefault();
      addFiles(files);
    }
  }

  async function handleDelete() {
    try {
      await deleteConversation.mutateAsync(id);
      router.push("/ai");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleRename() {
    if (!renameValue.trim()) return;
    try {
      await updateConversation.mutateAsync({ id, title: renameValue.trim() });
      setRenameOpen(false);
      toast.success("Conversation renamed");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  function openRename() {
    setRenameValue(conversation?.title ?? "");
    setRenameOpen(true);
  }

  function copyMessage(content: string) {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  }

  return (
    <>
      {/* Mobile header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push("/ai")}
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 truncate text-sm font-medium">
          {conversation?.title ?? "Conversation"}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={openRename}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop header */}
      <div className="hidden items-center gap-3 border-b border-border px-6 py-3 md:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <button
              onClick={openRename}
              className="text-sm font-medium hover:text-primary"
            >
              {conversation?.title ?? "Conversation"}
            </button>
            {conversation && (
              <p className="text-[11px] text-muted-foreground">
                {conversation.provider} &middot; {conversation.model}
              </p>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={openRename}
            aria-label="Rename"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AttachmentDropZone
        onFilesDropped={(files) => addFiles(files)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        {/* Messages area */}
        <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-4 md:px-6">
            {messagesLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {!messagesLoading && allMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">
                  {conversation?.title || "New conversation"}
                </h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Start a conversation with the Voltx AI assistant. Ask questions, analyze data, or get help with your workspace.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1">
              {allMessages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "group flex gap-3 px-2 py-3 md:px-4",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div className={cn("flex max-w-[85%] flex-col gap-1 md:max-w-[75%]")}>
                    {message.role === "user" ? (
                      <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                        <p className="whitespace-pre-wrap">{message.content || "*(file attachment)*"}</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
                        {message.id.startsWith("error-") ? (
                          <MarkdownMessage content={message.content} />
                        ) : message.id.startsWith("temp-") || message.isStreaming ? (
                          <MarkdownMessage content={message.content} />
                        ) : (
                          <MarkdownMessage content={message.content} />
                        )}
                      </div>
                    )}

                    {message.role === "assistant" && !message.id.startsWith("temp-") && (
                      <div className="flex items-center gap-1 px-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => copyMessage(message.content)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                          aria-label="Copy message"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {index === allMessages.length - 1 && !isStreaming && (
                          <button
                            type="button"
                            onClick={() => {
                              setInput(message.content);
                              textareaRef.current?.focus();
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                            aria-label="Retry this response as input"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {message.role === "user" && (
                      <div className={cn(
                        "px-1",
                        message.id.startsWith("failed-") && "text-xs text-destructive",
                      )}>
                        {message.id.startsWith("failed-") && "Failed to send"}
                      </div>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Streaming indicator */}
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 px-4 py-3"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl bg-secondary px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Retry banner */}
              {!isStreaming && retryMessageId && (
                <div className="flex items-center justify-center gap-2 px-4 py-2">
                  <p className="text-xs text-muted-foreground">Message failed to send</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={handleRetry}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </Button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Scroll to bottom button */}
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-4 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-colors hover:bg-secondary"
              aria-label="Scroll to bottom"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.button>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border">
          <div className="mx-auto max-w-3xl px-4 py-3 md:px-6">
            <AttachmentChipList uploads={uploads} onRetry={retry} onRemove={remove} className="mb-2" />
            <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 focus-within:border-primary/50 focus-within:shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addFiles(e.target.files);
                  }
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Ask anything..."
                className="min-h-[36px] flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                rows={1}
                autoFocus
              />
              {isStreaming ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={stopStreaming}
                  className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                  aria-label="Stop generating"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={(!input.trim() && readyAttachmentIds.length === 0) || isUploading}
                  className="h-9 w-9 shrink-0"
                  aria-label="Send message"
                >
                  <CornerDownLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
              AI responses may not be accurate. Verify important information.
            </p>
          </div>
        </div>
      </AttachmentDropZone>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation</DialogTitle>
            <DialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              isLoading={deleteConversation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>
              Give your conversation a descriptive name.
            </DialogDescription>
          </DialogHeader>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Conversation title"
            autoFocus
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} isLoading={updateConversation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
