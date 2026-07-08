"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Send, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useConversationMessages, useSendMessage } from "@/hooks/use-ai";
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.items.length]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sendMessage.isPending) return;
    setInput("");
    try {
      await sendMessage.mutateAsync(content);
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
                className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    message.role === "user" ? "bg-secondary" : "bg-primary/15 text-primary",
                  )}
                >
                  {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
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

      <div className="flex items-end gap-2 border-t border-border pt-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          className="min-h-[44px] flex-1 resize-none"
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSend}
          isLoading={sendMessage.isPending}
          disabled={!input.trim()}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
