"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Paperclip, Send, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentChipList, AttachmentDropZone } from "@/components/attachments/attachment-uploader";
import { MessageAttachments } from "@/components/attachments/message-attachments";
import { useConversationMessages, useSendMessage } from "@/hooks/use-ai";
import { useAttachmentUploads } from "@/hooks/use-attachments";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";
import { LoadingScreen } from "@/components/loading-screen";

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading } = useConversationMessages(id);
  const sendMessage = useSendMessage(id);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploads, addFiles, retry, remove, reset, readyAttachmentIds, isUploading } =
    useAttachmentUploads();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.items.length]);

  async function handleSend() {
    const content = input.trim();
    if ((!content && readyAttachmentIds.length === 0) || sendMessage.isPending || isUploading) return;
    setInput("");
    const attachmentIds = readyAttachmentIds;
    try {
      await sendMessage.mutateAsync({ content, attachmentIds });
      reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
      setInput(content);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files);
    if (files.length > 0) {
      event.preventDefault();
      addFiles(files);
    }
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push("/ai")}
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold">Conversation</h1>
      </div>

      <AttachmentDropZone onFilesDropped={(files) => addFiles(files)} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto py-4">
          <div className="flex flex-col gap-4">
            {data?.items
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "flex flex-col gap-1.5",
                    message.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}>
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        message.role === "user" ? "bg-secondary" : "bg-primary/15 text-primary",
                      )}
                    >
                      {message.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                  <MessageAttachments
                    messageId={message.id}
                    align={message.role === "user" ? "end" : "start"}
                  />
                </motion.div>
              ))}

            {sendMessage.isPending && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-secondary px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <AttachmentChipList uploads={uploads} onRetry={retry} onRemove={remove} />
          <div className="flex items-end gap-2">
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
              className="h-9 w-9 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach files"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Ask anything... (drag & drop or paste files to attach)"
              className="min-h-[44px] flex-1 resize-none"
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleSend}
              isLoading={sendMessage.isPending}
              disabled={(!input.trim() && readyAttachmentIds.length === 0) || isUploading}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </AttachmentDropZone>
    </div>
  );
}
