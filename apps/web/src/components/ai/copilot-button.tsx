"use client";

import { useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCopilotAsk } from "@/hooks/use-copilot";
import type { LucideIcon } from "lucide-react";

interface CopilotButtonProps {
  label: string;
  dialogTitle: string;
  prompt: string;
  context: string[];
  icon?: LucideIcon;
  variant?: "outline" | "ghost" | "secondary";
  size?: "sm" | "default";
}

/**
 * Contextual AI Copilot action (Phase 5 requirement #4): a small button
 * that, on click, asks a real question to the AI with real page context
 * attached, and shows the real response — no canned/simulated text.
 */
export function CopilotButton({
  label,
  dialogTitle,
  prompt,
  context,
  icon: Icon = Sparkles,
  variant = "outline",
  size = "sm",
}: CopilotButtonProps) {
  const { text, loading, error, ask, reset } = useCopilotAsk();
  const open = text !== null || loading || error !== null;

  useEffect(() => {
    if (!open) reset();
    // Only reset when the dialog is closed externally — not a state to depend on directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClick() {
    void ask(dialogTitle, prompt, context);
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={handleClick}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !next && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {dialogTitle}
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
