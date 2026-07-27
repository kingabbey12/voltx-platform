"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import styles from "./today.module.css";
import { TodaySidebar } from "./today-sidebar";
import { TodayBriefSection } from "./today-brief";
import { HeldLedger } from "./held-ledger";
import { ReplyLine } from "./reply-line";
import { AskExchangeSection } from "./ask-exchange";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useMyOrganizations } from "@/hooks/use-organizations";
import { useTodayBrief } from "@/hooks/use-today-brief";
import { useHeldWork, type HeldWorkItem } from "@/hooks/use-held-work";
import { useAsk } from "@/hooks/use-ask";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

/**
 * The Today screen, assembled per the frozen spec: a dated letter — the
 * brief, the held-work ledger, the reply line — with the keyboard grammar
 * (type anywhere, ⌘K, ↑↓ through the ledger, Enter opens, ⌘Enter signs,
 * Esc returns) and the focus, motion, loading, empty and error treatments.
 * The reply line speaks to Ask (docs/design/ASK.md): whole sentences,
 * grounded doors, inline answers, and held work flowing into the ledger.
 */
export function TodayScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const organizations = useMyOrganizations();

  const workspaceName = useMemo(() => {
    const membership = organizations.data?.find(
      (candidate) => candidate.organizationId === user?.organizationId,
    );
    return membership?.organizationName ?? "";
  }, [organizations.data, user?.organizationId]);

  const brief = useTodayBrief(user?.organizationId);
  const held = useHeldWork();

  // The one-arrival rule: chrome, date, and reply render in first paint; the
  // brief and the ledger arrive together, never one pushing the other.
  const arriving = brief.loading;

  // ————— Ask: the reply line, wired to the grounded pipeline —————
  const { exchange, ask, stop } = useAsk(held.refreshLedger);
  const [draft, setDraft] = useState("");
  const replyRef = useRef<HTMLInputElement>(null);

  const submitAsk = useCallback(() => {
    const prompt = draft.trim();
    if (prompt.length === 0) return;
    setDraft("");
    void ask(prompt);
  }, [draft, ask]);

  const askFollowUp = useCallback(
    (objective: string) => {
      void ask(objective);
    },
    [ask],
  );

  // ————— Ledger selection: the margin line, moved with the arrows —————
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const sentenceRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveSelection = useCallback(
    (delta: 1 | -1) => {
      if (held.items.length === 0) return;
      const current = selectedIndex ?? (delta === 1 ? -1 : held.items.length);
      const next = Math.min(Math.max(current + delta, 0), held.items.length - 1);
      setSelectedIndex(next);
      sentenceRefs.current[next]?.focus();
    },
    [held.items.length, selectedIndex],
  );

  const openItem = useCallback(() => {
    // Review happens where approvals live today.
    router.push("/ai/operator");
  }, [router]);

  const signItem = useCallback(
    (item: HeldWorkItem) => {
      if (item.status === "sent" || item.status === "sending") return;
      void held.sign(item.approval.id);
    },
    [held],
  );

  // ————— The keyboard grammar —————
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // ⌘K — go to the reply line deliberately.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        replyRef.current?.focus();
        return;
      }

      // ⌘Enter — sign the selected held document.
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        if (!arriving && selectedIndex !== null && held.items[selectedIndex]) {
          event.preventDefault();
          signItem(held.items[selectedIndex]);
        }
        return;
      }

      // Esc — return: stop the stream, then set down the reply, then clear
      // the selection. A draft is always kept.
      if (event.key === "Escape") {
        if (exchange.status === "asking") {
          stop();
          return;
        }
        if (document.activeElement === replyRef.current) {
          replyRef.current?.blur();
          return;
        }
        setSelectedIndex(null);
        return;
      }

      if (isEditableTarget(event.target)) return;

      // ↓ / ↑ — move between held documents.
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!arriving && held.items.length > 0) {
          event.preventDefault();
          moveSelection(event.key === "ArrowDown" ? 1 : -1);
        }
        return;
      }

      // Any letter — typing anywhere falls into the reply line.
      if (
        event.key.length === 1 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        setDraft((current) => current + event.key);
        replyRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [arriving, exchange.status, stop, held.items, moveSelection, selectedIndex, signItem]);

  return (
    <div className={styles.screen}>
      <TodaySidebar workspaceName={workspaceName} personName={user?.firstName ?? ""} />
      <main className={styles.col}>
        <h1 className={styles.date}>{format(new Date(), "EEEE, MMMM d")}</h1>

        <TodayBriefSection brief={brief} />

        {!arriving && (
          <HeldLedger
            items={held.items}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onOpen={openItem}
            onSign={signItem}
            sentenceRefs={sentenceRefs}
          />
        )}

        <AskExchangeSection exchange={exchange} onAsk={askFollowUp} />

        <ReplyLine ref={replyRef} value={draft} onChange={setDraft} onSubmit={submitAsk} />
      </main>
    </div>
  );
}
